# GridPulse Backend

A real Express + PostgreSQL backend for the GridPulse electricity market
platform: authentication, a persistent database, and a market data layer
that can run on free seeded demo data or on real day-ahead price feeds.

This is runnable code, not a mockup. It has not been executed against a live
database or a live price feed from the environment it was written in,
because that environment has no network access. Treat it as a strong
starting point to run and test yourself, not as something already verified
end to end.

## What's real here

- Password hashing (bcrypt) and JWT-based sessions, not a fake login screen.
- A proper relational schema (Prisma / Postgres) for users, markets, prices,
  watchlists, alerts, positions, trades, and business profiles.
- A real client for ENTSO-E's Transparency Platform (free EU day-ahead
  prices) that parses the actual XML response format.
- A stub client for Elexon's BMRS API (GB prices) with the endpoint shape
  laid out, ready for you to confirm against Elexon's current docs.
- A provider layer that defaults to demo data everywhere, and only serves
  live data for a market once you've supplied a working API credential for
  it — so nothing breaks while you're still setting accounts up.
- Paper trading with real persistence: positions, balances, and trade
  history live in Postgres, not in browser memory.

## What is deliberately not here

- Real-money trade execution. That needs a licensed broker/exchange
  relationship, KYC/AML, and regulatory review specific to your market and
  jurisdiction. Building a fake version of that would be worse than not
  building it, so the code stops at simulation and leaves clean interfaces
  (see `src/routes/positions.js`) for where real execution would plug in.
- A signed commercial data license with EPEX Spot, Nord Pool, or similar.
  Those require an actual company to apply and pay for access. What's
  included instead — ENTSO-E and Elexon — are free, legitimate public
  sources that cover day-ahead prices for most of Europe and the UK, and
  are what many smaller platforms actually start with.
- Deployment. Nothing is hosted. You'll need a Postgres instance and
  somewhere to run a Node process (Railway, Render, Fly.io, a VPS, etc).

## Getting it running

```bash
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET at minimum. Leave MARKET_DATA_MODE=demo
# to start — everything works with zero external credentials in that mode.

npm install
npx prisma migrate dev --name init
npm run dev
```

The API comes up on `http://localhost:4000`. Try:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/markets
```

## Switching a market to live data

1. Register for a free ENTSO-E token at
   https://transparency.entsoe.eu/ (Account Settings → Web API Security
   Token). For GB, register separately at https://bmrs.elexon.co.uk/.
2. Put the token(s) in `.env` as `ENTSOE_API_TOKEN` / `ELEXON_API_KEY`.
3. Set `MARKET_DATA_MODE=live`.
4. Run `npm run sync:prices` once to backfill history, then run it with
   `--watch` (or point your host's own scheduler at it) to keep it current:
   `node src/jobs/priceSync.js --watch`.
5. Before trusting it, manually check that a returned price for a market
   you know matches what's published on that exchange's own site for the
   same hour. ENTSO-E's schema is versioned and does shift over time, and
   the XML parsing in `EntsoeMarketDataProvider.js` should be spot-checked
   against a real response, since it couldn't be tested against the live
   API from here.

If a market's provider isn't configured yet, the app automatically falls
back to demo data for that market and logs why, rather than erroring out.

## API overview

```
POST   /auth/signup
POST   /auth/login
GET    /auth/me

GET    /markets
GET    /markets/:id
GET    /markets/:id/prices?hours=168
GET    /markets/:id/statistics

GET    /watchlist
POST   /watchlist            { marketId }
DELETE /watchlist/:marketId

GET    /alerts
POST   /alerts               { marketId, condition, value }
DELETE /alerts/:id
POST   /alerts/evaluate

GET    /positions
POST   /positions            { marketId, direction, stake, stopLoss?, takeProfit? }
POST   /positions/:id/close

GET    /portfolio
GET    /portfolio/trades

GET    /business/profile
PUT    /business/profile
POST   /business/estimate

GET    /notifications
POST   /notifications/:id/read

GET    /admin/users              (admin only)
GET    /admin/markets/status     (admin only)
GET    /admin/system-health      (admin only)
```

All routes except `/health`, `/markets*`, and `/auth/*` require an
`Authorization: Bearer <token>` header from `/auth/login` or `/auth/signup`.

## Before enabling real-money trading, at minimum

- A licensed broker or exchange relationship for whatever instrument you'd
  actually be offering exposure through.
- KYC/AML identity verification on signup.
- Legal review of what you're offering in each jurisdiction you operate in
  — electricity-price derivatives for retail users sit in a genuinely
  regulated space in most countries.
- Real settlement and custody of funds, which is a different problem than
  anything in this repository.

None of that can be shortcut, and it's the reason this build stops at a
solid, honest paper-trading platform rather than pretending further.
