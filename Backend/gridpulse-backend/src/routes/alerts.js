const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { getMarketSeries } = require("../services/marketData");
const { computeMarketStats } = require("../lib/stats");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const alerts = await prisma.alert.findMany({ where: { userId: req.userId }, include: { market: true } });
  res.json({ alerts });
});

router.post("/", async (req, res) => {
  const { marketId, condition, value } = req.body;
  if (!marketId || !condition) {
    return res.status(400).json({ error: "invalid_input", message: "marketId and condition are required." });
  }
  const allowed = ["above", "below", "pct_change_24h"];
  if (!allowed.includes(condition)) {
    return res.status(400).json({ error: "invalid_input", message: `condition must be one of ${allowed.join(", ")}` });
  }

  const alert = await prisma.alert.create({
    data: { userId: req.userId, marketId, condition, value: Number(value) || 0 },
  });
  res.status(201).json({ alert });
});

router.delete("/:id", async (req, res) => {
  const alert = await prisma.alert.findUnique({ where: { id: req.params.id } });
  if (!alert || alert.userId !== req.userId) return res.status(404).json({ error: "not_found" });
  await prisma.alert.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// Not wired to a push/email sender yet — this evaluates alerts against
// current prices so a scheduled job (or a request from the frontend) can
// see which ones are currently true. Wiring actual delivery (email/SMS/push)
// is a deliberately separate piece: it needs a transactional email or push
// provider account, which is outside what can be set up from here.
async function evaluateAlertsForUser(userId) {
  const alerts = await prisma.alert.findMany({ where: { userId, isActive: true } });
  const triggered = [];

  for (const alert of alerts) {
    const series = await getMarketSeries(alert.marketId);
    const stats = computeMarketStats(series);
    if (!stats) continue;

    let isTrue = false;
    if (alert.condition === "above") isTrue = stats.current > alert.value;
    if (alert.condition === "below") isTrue = stats.current < alert.value;
    if (alert.condition === "pct_change_24h") isTrue = Math.abs(stats.change24) > alert.value;

    if (isTrue) {
      triggered.push({ alert, current: stats.current });
      await prisma.alert.update({ where: { id: alert.id }, data: { triggeredAt: new Date() } });
      await prisma.notification.create({
        data: {
          userId,
          message: `${alert.marketId.toUpperCase()} ${alert.condition.replace("_", " ")} ${alert.value} (now ${stats.current})`,
        },
      });
    }
  }
  return triggered;
}

router.post("/evaluate", async (req, res) => {
  const triggered = await evaluateAlertsForUser(req.userId);
  res.json({ triggered });
});

module.exports = router;
module.exports.evaluateAlertsForUser = evaluateAlertsForUser;
