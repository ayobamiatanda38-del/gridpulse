const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { MARKET_DEFS, providers } = require("../services/marketData");

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/users", async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, accountType: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ users });
});

router.get("/markets/status", async (req, res) => {
  const status = await Promise.all(
    MARKET_DEFS.map(async (def) => {
      const latest = await prisma.marketPrice.findFirst({
        where: { marketId: def.id },
        orderBy: { timestamp: "desc" },
      });
      return {
        marketId: def.id,
        provider: def.dataProvider,
        mode: providers.mode,
        lastStoredPrice: latest?.timestamp || null,
        freshnessHours: latest ? Math.round((Date.now() - latest.timestamp.getTime()) / 3600000) : null,
      };
    })
  );
  res.json({ mode: providers.mode, markets: status });
});

router.get("/system-health", async (req, res) => {
  const userCount = await prisma.user.count();
  const positionCount = await prisma.position.count({ where: { status: "open" } });
  const priceRowCount = await prisma.marketPrice.count();
  res.json({
    ok: true,
    dataMode: providers.mode,
    userCount,
    openPositions: positionCount,
    storedPriceRows: priceRowCount,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
