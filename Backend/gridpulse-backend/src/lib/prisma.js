const { PrismaClient } = require("@prisma/client");

// Reuse a single client across the app (and across hot reloads in dev)
// instead of opening a new connection pool per request.
const prisma = global.__gridpulsePrisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") global.__gridpulsePrisma = prisma;

module.exports = prisma;
