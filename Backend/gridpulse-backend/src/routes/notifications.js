const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ notifications });
});

router.post("/:id/read", async (req, res) => {
  const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!n || n.userId !== req.userId) return res.status(404).json({ error: "not_found" });
  await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
  res.status(204).end();
});

module.exports = router;
