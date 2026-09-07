const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const signupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  country: z.string().optional(),
  accountType: z.enum(["individual", "business"]).default("individual"),
});

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", message: parsed.error.issues[0].message });
  }
  const { name, email, password, country, accountType } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "email_taken", message: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name, email, passwordHash, country, accountType,
      portfolio: { create: { demoBalance: 10000 } },
    },
  });

  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", message: "Enter a valid email and password." });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Same error for "no such user" and "wrong password" on purpose,
  // so a login attempt can't be used to discover which emails exist.
  const invalid = () => res.status(401).json({ error: "invalid_credentials", message: "Incorrect email or password." });

  if (!user) return invalid();
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return invalid();

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "not_found" });
  res.json({ user: publicUser(user) });
});

module.exports = router;
