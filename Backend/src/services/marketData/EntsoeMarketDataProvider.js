// Real integration with ENTSO-E's Transparency Platform (day-ahead prices, A44).
// Free for anyone to use: register at https://transparency.entsoe.eu/ and
// generate a security token under Account Settings > Web API Security Token.
//
// IMPORTANT: this code has not been exercised against the live API from this
// environment (no outbound network access here). The request shape below
// matches ENTSO-E's documented REST API as of this writing, but ENTSO-E's
// schema is versioned and does change — before relying on this in production,
// run one real request against https://web-api.tp.entsoe.eu/api and confirm
// the field names in the parsed XML still match what this file expects.
// Full docs: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html

const axios = require("axios");
const { XMLParser } = require("fast-xml-parser");

const BASE_URL = "https://web-api.tp.entsoe.eu/api";

// EIC codes for a starting set of bidding zones. Extend this as you add markets.
// (Source: ENTSO-E's published Areas list — confirm codes against the current
// list before going live, as some zones have split or been reconfigured.)
const BIDDING_ZONES = {
  de: "10Y1001A1001A82H", // Germany-Luxembourg
  fr: "10YFR-RTE------C", // France
  es: "10YES-REE------0", // Spain
  it: "10Y1001A1001A73I", // Italy (North; Italy is split into multiple zones)
  nl: "10YNL----------L", // Netherlands
  pl: "10YPL-AREA-----S", // Poland
  no: "10YNO-0--------C", // Norway (Nordics are split into NO1-NO5; pick a zone)
};

function formatEntsoeDate(date) {
  // ENTSO-E expects UTC timestamps as yyyyMMddHHmm
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes())
  );
}

class EntsoeMarketDataProvider {
  constructor({ apiToken, biddingZones = BIDDING_ZONES } = {}) {
    if (!apiToken) throw new Error("EntsoeMarketDataProvider requires an ENTSO-E API token.");
    this.apiToken = apiToken;
    this.biddingZones = biddingZones;
    this.parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  }

  /**
   * Fetches day-ahead hourly prices for one market between two dates.
   * Returns [{ timestamp: Date, price: number, currency: string, source: "entsoe" }]
   */
  async getSeries(marketId, { from, to } = {}) {
    const zone = this.biddingZones[marketId];
    if (!zone) throw new Error(`No ENTSO-E bidding zone configured for market "${marketId}".`);

    const periodEnd = to || new Date();
    const periodStart = from || new Date(periodEnd.getTime() - 7 * 24 * 3600 * 1000);

    const params = {
      documentType: "A44", // Price document (day-ahead prices)
      in_Domain: zone,
      out_Domain: zone,
      periodStart: formatEntsoeDate(periodStart),
      periodEnd: formatEntsoeDate(periodEnd),
      securityToken: this.apiToken,
    };

    const { data: xml } = await axios.get(BASE_URL, { params, timeout: 15000 });
    return this._parsePriceDocument(xml, zone);
  }

  _parsePriceDocument(xml, zone) {
    const doc = this.parser.parse(xml);
    const root = doc.Publication_MarketDocument;
    if (!root) {
      throw new Error("Unexpected ENTSO-E response shape — check securityToken and zone code.");
    }

    const timeSeriesList = Array.isArray(root.TimeSeries) ? root.TimeSeries : [root.TimeSeries];
    const points = [];

    for (const ts of timeSeriesList.filter(Boolean)) {
      const currency = ts["currency_Unit.name"] || "EUR";
      const periods = Array.isArray(ts.Period) ? ts.Period : [ts.Period];

      for (const period of periods.filter(Boolean)) {
        const start = new Date(period.timeInterval.start);
        const resolution = period.resolution; // e.g. "PT60M"
        const stepMinutes = resolution === "PT30M" ? 30 : 60;

        const pointsList = Array.isArray(period.Point) ? period.Point : [period.Point];
        for (const p of pointsList.filter(Boolean)) {
          const position = Number(p.position);
          const timestamp = new Date(start.getTime() + (position - 1) * stepMinutes * 60 * 1000);
          points.push({
            timestamp,
            price: Number(p["price.amount"]),
            currency,
            source: "entsoe",
          });
        }
      }
    }

    return points.sort((a, b) => a.timestamp - b.timestamp);
  }
}

module.exports = { EntsoeMarketDataProvider, BIDDING_ZONES };
