// IMPORTANT: everything in this file is simulated ("paper") trading against
// a per-user demo balance stored in Postgres. No real money or electricity
// changes hands anywhere in this code. Real execution would require a
// licensed trading/brokerage relationship and regulatory review — see the
// README for why that's deliberately not implemented here.

const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { getMarketSeries } = require("../services/marketData");
const { computeMarketStats } = require("../lib/stats");

const router = express.Router();
router.use(requireAuth);

const LEVERAGE = 8; // simulated leverage constant, for illustration only

async function currentPrice(marketId) {
  const series = await getMarketSeries(marketId);
  const stats = computeMarketStats(series);
  return stats.current;
}

function pnlFor(position, price) {
  const dir = position.direction === "long" ? 1 : -1;
  return dir * ((price - position.entryPrice) / position.entryPrice) * position.stake * (position.leverage || LEVERAGE);
}

router.get("/", async (req, res) => {
  const positions = await prisma.position.findMany({
    where: { userId: req.userId },
    include: { market: true },
    orderBy: { openedAt: "desc" },
  });

  const withPnl = await Promise.all(
    positions.map(async (p) => {
      if (p.status === "closed") return p;
      const price = await currentPrice(p.marketId);
      return { ...p, currentPrice: price, unrealizedPnl: pnlFor(p, price) };
    })
  );

  res.json({ positions: withPnl });
});

router.post("/", async (req, res) => {
  const { marketId, direction, stake, stopLoss, takeProfit } = req.body;
  if (!marketId || !["long", "short"].includes(direction) || !stake || stake <= 0) {
    return res.status(400).json({ error: "invalid_input", message: "marketId, direction (long/short), and a positive stake are required." });
  }

  const portfolio = await prisma.portfolio.findUnique({ where: { userId: req.userId } });
  if (!portfolio || portfolio.demoBalance < stake) {
    return res.status(400).json({ error: "insufficient_balance", message: "Not enough demo balance for this stake." });
  }

  const entryPrice = await currentPrice(marketId);

  const [position] = await prisma.$transaction([
    prisma.position.create({
      data: { userId: req.userId, marketId, direction, stake: Number(stake), entryPrice, stopLoss: stopLoss || null, takeProfit: takeProfit || null, leverage: LEVERAGE },
    }),
    prisma.portfolio.update({ where: { userId: req.userId }, data: { demoBalance: { decrement: Number(stake) } } }),
  ]);

  res.status(201).json({ position, message: "Simulated position opened. No real electricity or funds were involved." });
});

router.post("/:id/close", async (req, res) => {
  const position = await prisma.position.findUnique({ where: { id: req.params.id } });
  if (!position || position.userId !== req.userId) return res.status(404).json({ error: "not_found" });
  if (position.status === "closed") return res.status(400).json({ error: "already_closed" });

  const price = await currentPrice(position.marketId);
  const pnl = pnlFor(position, price);

  const [closed] = await prisma.$transaction([
    prisma.position.update({
      where: { id: position.id },
      data: { status: "closed", closedAt: new Date(), closePrice: price, pnl },
    }),
    prisma.portfolio.update({
      where: { userId: req.userId },
      data: { demoBalance: { increment: position.stake + pnl } },
    }),
    prisma.trade.create({
      data: {
        userId: req.userId, marketId: position.marketId, positionId: position.id,
        direction: position.direction, entryPrice: position.entryPrice, exitPrice: price,
        stake: position.stake, pnl,
      },
    }),
  ]);

  res.json({ position: closed, pnl });
});

module.exports = router;
