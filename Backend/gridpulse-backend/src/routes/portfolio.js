const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { getMarketSeries } = require("../services/marketData");
const { computeMarketStats } = require("../lib/stats");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const portfolio = await prisma.portfolio.findUnique({ where: { userId: req.userId } });
  const openPositions = await prisma.position.findMany({ where: { userId: req.userId, status: "open" } });
  const closedTrades = await prisma.trade.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "asc" } });

  let unrealized = 0;
  for (const p of openPositions) {
    const series = await getMarketSeries(p.marketId);
    const stats = computeMarketStats(series);
    const dir = p.direction === "long" ? 1 : -1;
    unrealized += dir * ((stats.current - p.entryPrice) / p.entryPrice) * p.stake * (p.leverage || 8);
  }

  const stakedInOpen = openPositions.reduce((a, p) => a + p.stake, 0);
  const totalValue = (portfolio?.demoBalance || 0) + stakedInOpen + unrealized;
  const wins = closedTrades.filter((t) => t.pnl > 0).length;
  const winRate = closedTrades.length ? Math.round((wins / closedTrades.length) * 100) : 0;

  res.json({
    demoBalance: portfolio?.demoBalance || 0,
    openPositionsCount: openPositions.length,
    unrealizedPnl: unrealized,
    totalValue,
    winRate,
    closedTradesCount: closedTrades.length,
  });
});

router.get("/trades", async (req, res) => {
  const trades = await prisma.trade.findMany({
    where: { userId: req.userId },
    include: { market: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ trades });
});

module.exports = router;
