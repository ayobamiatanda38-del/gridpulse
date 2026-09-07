const express = require("express");
const prisma = require("../lib/prisma");
const { MARKET_DEFS, getMarketSeries, providers } = require("../services/marketData");
const { computeMarketStats } = require("../lib/stats");

const router = express.Router();

// GET /markets — list every market with current stats
router.get("/", async (req, res) => {
  const results = await Promise.all(
    MARKET_DEFS.map(async (def) => {
      const series = await getMarketSeries(def.id);
      const stats = computeMarketStats(series);
      return { ...def, ...stats, isDemo: providers.mode !== "live" };
    })
  );
  res.json({ markets: results, mode: providers.mode });
});

// GET /markets/:id — single market with stats
router.get("/:id", async (req, res) => {
  const def = MARKET_DEFS.find((m) => m.id === req.params.id);
  if (!def) return res.status(404).json({ error: "not_found", message: "Unknown market." });

  const series = await getMarketSeries(def.id);
  const stats = computeMarketStats(series);
  res.json({ ...def, ...stats, isDemo: providers.mode !== "live" });
});

// GET /markets/:id/prices?hours=168 — raw series for charting
router.get("/:id/prices", async (req, res) => {
  const def = MARKET_DEFS.find((m) => m.id === req.params.id);
  if (!def) return res.status(404).json({ error: "not_found" });

  const hours = Math.min(Number(req.query.hours) || 168, 24 * 90);
  const series = await getMarketSeries(def.id);
  res.json({ marketId: def.id, points: series.slice(-hours), isDemo: providers.mode !== "live" });
});

// GET /markets/:id/statistics
router.get("/:id/statistics", async (req, res) => {
  const def = MARKET_DEFS.find((m) => m.id === req.params.id);
  if (!def) return res.status(404).json({ error: "not_found" });
  const series = await getMarketSeries(def.id);
  res.json(computeMarketStats(series));
});

module.exports = router;
