// Instância única do Prisma Client para todo o backend (ADR-0002).
require('dotenv').config({ quiet: true });

const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('../../generated/prisma');

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./dev.db',
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
