const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/profile", async (req, res) => {
  const profile = await prisma.businessProfile.findUnique({ where: { userId: req.userId } });
  res.json({ profile });
});

router.put("/profile", async (req, res) => {
  const { monthlyUsageKwh, currentPriceKwh, industry } = req.body;
  const profile = await prisma.businessProfile.upsert({
    where: { userId: req.userId },
    update: { monthlyUsageKwh, currentPriceKwh, industry },
    create: { userId: req.userId, monthlyUsageKwh, currentPriceKwh, industry },
  });
  res.json({ profile });
});

// Stateless calculation — doesn't require a saved profile, mirrors the
// frontend calculator so it can be reused server-side (e.g. for a quote
// emailed to the user later).
router.post("/estimate", (req, res) => {
  const usageKwh = Number(req.body.usageKwh) || 0;
  const currentPrice = Number(req.body.currentPrice) || 0;
  const futurePrice = Number(req.body.futurePrice) || 0;

  const currentCost = usageKwh * currentPrice;
  const futureCost = usageKwh * futurePrice;
  const diff = futureCost - currentCost;
  const pctChange = currentCost ? (diff / currentCost) * 100 : 0;

  res.json({
    currentCost,
    futureCost,
    difference: diff,
    percentChange: pctChange,
    annualizedImpact: diff * 12,
    disclaimer: "Illustrative only. Not a quote, guarantee, or energy procurement advice.",
  });
});

module.exports = router;
