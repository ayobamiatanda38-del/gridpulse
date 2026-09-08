// Deterministic seeded demo data, mirroring the frontend prototype's generator,
// so the API returns realistic-shaped prices with zero external dependencies.
// This is what MARKET_DATA_MODE=demo uses. It is clearly labeled "demo" in
// every response so it can never be confused with a live feed.

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateSeries(market, hours = 168) {
  const rnd = mulberry32(hashSeed(market.id + "-gridpulse-v1"));
  const renewShare = market.renewShare ?? 0.4;
  const base = market.base ?? 100;
  const series = [];
  let walk = 0;
  const now = Date.now();
  for (let h = hours - 1; h >= 0; h--) {
    const t = now - h * 3600 * 1000;
    const hourOfDay = new Date(t).getHours();
    const solarDip = renewShare * 0.5 * Math.max(0, Math.sin((Math.PI * (hourOfDay - 6)) / 12)) * (hourOfDay > 6 && hourOfDay < 19 ? 1 : 0);
    const eveningPeak = hourOfDay >= 17 && hourOfDay <= 21 ? 0.3 * Math.exp(-Math.pow(hourOfDay - 19, 2) / 3) : 0;
    const nightDip = hourOfDay >= 1 && hourOfDay <= 5 ? 0.18 : 0;
    walk += (rnd() - 0.5) * 0.06;
    walk = Math.max(-0.35, Math.min(0.35, walk));
    const noise = (rnd() - 0.5) * 0.08;
    let mult = 1 - solarDip + eveningPeak - nightDip + walk + noise;
    let price = base * mult;
    if (renewShare > 0.5 && hourOfDay >= 11 && hourOfDay <= 14 && rnd() < 0.06) {
      price = -Math.abs(price * 0.15) - rnd() * 8;
    }
    series.push({ timestamp: new Date(t), price: Math.round(price * 100) / 100 });
  }
  return series;
}

class DemoMarketDataProvider {
  constructor(marketDefs) {
    this.marketDefs = marketDefs; // [{id, base, renewShare, currency, ...}]
  }

  async getSeries(marketId, hours = 168) {
    const def = this.marketDefs.find((m) => m.id === marketId);
    if (!def) throw new Error(`Unknown market: ${marketId}`);
    return generateSeries(def, hours).map((p) => ({ ...p, source: "demo" }));
  }

  async getAllLatest() {
    return this.marketDefs.map((def) => {
      const series = generateSeries(def, 2);
      return { marketId: def.id, ...series[series.length - 1], source: "demo" };
    });
  }
}

module.exports = { DemoMarketDataProvider, generateSeries };
