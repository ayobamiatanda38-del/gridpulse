// Integration point for Elexon's BMRS Insights API (GB day-ahead / imbalance prices).
// Free registration: https://bmrs.elexon.co.uk/
//
// Elexon's newer "Insights Solution" API is REST/JSON (unlike ENTSO-E's XML),
// which makes this considerably simpler once you have a key. Confirm the exact
// endpoint and field names against Elexon's current API reference before
// deploying — endpoint paths have moved as BMRS has been modernized.
// Docs: https://bmrs.elexon.co.uk/api-documentation

const axios = require("axios");

const BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1";

class ElexonMarketDataProvider {
  constructor({ apiKey } = {}) {
    if (!apiKey) throw new Error("ElexonMarketDataProvider requires an Elexon API key.");
    this.apiKey = apiKey;
  }

  /**
   * Fetches day-ahead price data for GB.
   * Returns [{ timestamp: Date, price: number, currency: "GBP", source: "elexon" }]
   */
  async getSeries(marketId, { from, to } = {}) {
    if (marketId !== "gb") throw new Error("ElexonMarketDataProvider only serves the gb market.");

    const periodTo = to || new Date();
    const periodFrom = from || new Date(periodTo.getTime() - 7 * 24 * 3600 * 1000);

    // Placeholder endpoint shape — replace with the confirmed day-ahead price
    // route from Elexon's current API reference before going live.
    const { data } = await axios.get(`${BASE_URL}/balancing/pricing/market-index`, {
      params: {
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
        apiKey: this.apiKey,
      },
      timeout: 15000,
    });

    const rows = data?.data || [];
    return rows.map((row) => ({
      timestamp: new Date(row.settlementDate + "T00:00:00Z"),
      price: Number(row.price),
      currency: "GBP",
      source: "elexon",
    }));
  }
}

module.exports = { ElexonMarketDataProvider };
