function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length;
  return Math.sqrt(v);
}

/**
 * @param {{timestamp: Date, price: number}[]} rows ascending by timestamp
 */
function computeMarketStats(rows) {
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  const prev24 = rows[rows.length - 25] || rows[0];
  const first = rows[0];
  const today = rows.slice(-24);
  const last48 = rows.slice(-48).map((p) => p.price);
  const returns = [];
  for (let i = 1; i < last48.length; i++) returns.push(last48[i] - last48[i - 1]);

  const cheapest = today.reduce((a, b) => (b.price < a.price ? b : a), today[0]);
  const priciest = today.reduce((a, b) => (b.price > a.price ? b : a), today[0]);

  return {
    current: last.price,
    lastUpdated: last.timestamp,
    change24: prev24.price !== 0 ? ((last.price - prev24.price) / Math.abs(prev24.price)) * 100 : 0,
    change7d: first.price !== 0 ? ((last.price - first.price) / Math.abs(first.price)) * 100 : 0,
    volatility: Math.round(stdev(returns) * 10) / 10,
    todayHigh: Math.max(...today.map((p) => p.price)),
    todayLow: Math.min(...today.map((p) => p.price)),
    average: Math.round((today.reduce((a, p) => a + p.price, 0) / today.length) * 100) / 100,
    prevClose: prev24.price,
    cheapestHour: cheapest,
    priciestHour: priciest,
  };
}

module.exports = { computeMarketStats, stdev };
