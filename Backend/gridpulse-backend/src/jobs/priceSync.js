// Pulls fresh day-ahead prices into the database.
// Day-ahead auctions typically publish tomorrow's prices in the early
// afternoon (CET), so once daily is enough for day-ahead data — this is not
// meant for intraday/real-time prices.
//
// Run once manually:   npm run sync:prices
// Run on a schedule:   node src/jobs/priceSync.js --watch
// (or trigger it from your host's own cron/scheduler, which is often more
// reliable than an in-process timer on platforms that sleep idle processes)

require("dotenv").config();
const cron = require("node-cron");
const prisma = require("../lib/prisma");
const { MARKET_DEFS, getMarketSeries, providers } = require("../services/marketData");

async function syncMarket(marketId) {
  const points = await getMarketSeries(marketId);
  if (!points.length) {
    console.log(`[priceSync] ${marketId}: no points returned`);
    return 0;
  }

  // Make sure the Market row exists before writing prices for it.
  const def = MARKET_DEFS.find((m) => m.id === marketId);
  await prisma.market.upsert({
    where: { id: marketId },
    update: {},
    create: {
      id: marketId,
      name: def.name,
      label: def.label,
      country: def.name,
      currency: def.currency === "£" ? "GBP" : "EUR",
      dataProvider: def.dataProvider,
    },
  });

  let written = 0;
  for (const p of points) {
    await prisma.marketPrice.upsert({
      where: { marketId_timestamp: { marketId, timestamp: p.timestamp } },
      update: { price: p.price, source: p.source },
      create: {
        marketId,
        timestamp: p.timestamp,
        price: p.price,
        currency: p.currency || def.currency,
        source: p.source,
      },
    });
    written++;
  }
  console.log(`[priceSync] ${marketId}: wrote ${written} price points (source: ${points[0].source})`);
  return written;
}

async function syncAll() {
  console.log(`[priceSync] starting sync — mode=${providers.mode} — ${new Date().toISOString()}`);
  for (const def of MARKET_DEFS) {
    try {
      await syncMarket(def.id);
    } catch (err) {
      console.error(`[priceSync] failed for ${def.id}:`, err.message);
    }
  }
  console.log("[priceSync] done");
}

if (require.main === module) {
  const watch = process.argv.includes("--watch");
  if (watch) {
    // 13:30 UTC daily — after EU day-ahead auction results are typically published.
    // Adjust to match the actual publication schedule of the zones you launch with.
    cron.schedule("30 13 * * *", syncAll);
    console.log("[priceSync] scheduled daily at 13:30 UTC. Running an initial sync now…");
    syncAll();
  } else {
    syncAll().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
  }
}

module.exports = { syncAll, syncMarket };
