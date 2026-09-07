const { DemoMarketDataProvider } = require("./DemoMarketDataProvider");
const { EntsoeMarketDataProvider } = require("./EntsoeMarketDataProvider");
const { ElexonMarketDataProvider } = require("./ElexonMarketDataProvider");

// The static market catalog. In production you'd likely move this into the
// Market table (it already exists in the Prisma schema) and read it from
// there; it's kept here as plain data too so the demo provider can run
// without touching the database.
const MARKET_DEFS = [
  { id: "de", name: "Germany", label: "Germany Day-Ahead", currency: "€", base: 118, renewShare: 0.62, dataProvider: "entsoe" },
  { id: "fr", name: "France", label: "France Day-Ahead", currency: "€", base: 94, renewShare: 0.38, dataProvider: "entsoe" },
  { id: "es", name: "Spain", label: "Spain Day-Ahead", currency: "€", base: 79, renewShare: 0.55, dataProvider: "entsoe" },
  { id: "gb", name: "United Kingdom", label: "UK Day-Ahead", currency: "£", base: 108, renewShare: 0.44, dataProvider: "elexon" },
  { id: "it", name: "Italy", label: "Italy Day-Ahead", currency: "€", base: 131, renewShare: 0.33, dataProvider: "entsoe" },
  { id: "no", name: "Nordics", label: "Nordics Day-Ahead", currency: "€", base: 44, renewShare: 0.86, dataProvider: "entsoe" },
  { id: "nl", name: "Netherlands", label: "Netherlands Day-Ahead", currency: "€", base: 113, renewShare: 0.41, dataProvider: "entsoe" },
  { id: "pl", name: "Poland", label: "Poland Day-Ahead", currency: "€", base: 142, renewShare: 0.21, dataProvider: "entsoe" },
];

function buildProviders() {
  const mode = process.env.MARKET_DATA_MODE || "demo";
  const demo = new DemoMarketDataProvider(MARKET_DEFS);

  if (mode === "demo") {
    return { mode, demo, entsoe: null, elexon: null };
  }

  let entsoe = null, elexon = null;
  if (process.env.ENTSOE_API_TOKEN) {
    entsoe = new EntsoeMarketDataProvider({ apiToken: process.env.ENTSOE_API_TOKEN });
  }
  if (process.env.ELEXON_API_KEY) {
    elexon = new ElexonMarketDataProvider({ apiKey: process.env.ELEXON_API_KEY });
  }
  return { mode, demo, entsoe, elexon };
}

const providers = buildProviders();

/**
 * Returns hourly price history for a market, routed to whichever provider
 * is configured for it. Falls back to demo data (clearly labeled) if a live
 * provider isn't configured yet, so the app degrades gracefully instead of
 * breaking while credentials are being set up.
 */
async function getMarketSeries(marketId, opts = {}) {
  const def = MARKET_DEFS.find((m) => m.id === marketId);
  if (!def) throw new Error(`Unknown market: ${marketId}`);

  if (providers.mode === "live") {
    try {
      if (def.dataProvider === "entsoe" && providers.entsoe) {
        return await providers.entsoe.getSeries(marketId, opts);
      }
      if (def.dataProvider === "elexon" && providers.elexon) {
        return await providers.elexon.getSeries(marketId, opts);
      }
    } catch (err) {
      console.error(`[marketData] live fetch failed for ${marketId}, falling back to demo:`, err.message);
    }
  }

  return providers.demo.getSeries(marketId, 168);
}

module.exports = { MARKET_DEFS, getMarketSeries, providers };
