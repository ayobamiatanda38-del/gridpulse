const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const items = await prisma.watchlist.findMany({ where: { userId: req.userId }, include: { market: true } });
  res.json({ watchlist: items });
});

router.post("/", async (req, res) => {
  const { marketId } = req.body;
  if (!marketId) return res.status(400).json({ error: "invalid_input", message: "marketId is required." });

  const item = await prisma.watchlist.upsert({
    where: { userId_marketId: { userId: req.userId, marketId } },
    update: {},
    create: { userId: req.userId, marketId },
  });
  res.status(201).json({ item });
});

router.delete("/:marketId", async (req, res) => {
  await prisma.watchlist.deleteMany({ where: { userId: req.userId, marketId: req.params.marketId } });
  res.status(204).end();
});

module.exports = router;
