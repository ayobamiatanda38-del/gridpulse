require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const marketsRoutes = require("./routes/markets");
const watchlistRoutes = require("./routes/watchlist");
const alertsRoutes = require("./routes/alerts");
const positionsRoutes = require("./routes/positions");
const portfolioRoutes = require("./routes/portfolio");
const businessRoutes = require("./routes/business");
const notificationsRoutes = require("./routes/notifications");
const adminRoutes = require("./routes/admin");
const { providers } = require("./services/marketData");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// Basic protection against brute-forcing login/signup. Tune per your traffic.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use("/auth", authLimiter);

app.get("/health", (req, res) => {
  res.json({ ok: true, dataMode: providers.mode, time: new Date().toISOString() });
});

app.use("/auth", authRoutes);
app.use("/markets", marketsRoutes);
app.use("/watchlist", watchlistRoutes);
app.use("/alerts", alertsRoutes);
app.use("/positions", positionsRoutes);
app.use("/portfolio", portfolioRoutes);
app.use("/business", businessRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/admin", adminRoutes);

// Centralized error handler so unexpected failures return a clean JSON
// error instead of leaking a stack trace to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "server_error", message: "Something went wrong on our end. Please try again in a moment." });
});

app.use((req, res) => {
  res.status(404).json({ error: "not_found", message: "That route doesn't exist." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`GridPulse API listening on port ${PORT} (data mode: ${providers.mode})`);
  if (providers.mode === "demo") {
    console.log("Running on demo market data. Set MARKET_DATA_MODE=live and add ENTSOE_API_TOKEN / ELEXON_API_KEY to switch to real feeds.");
  }
});

module.exports = app;
