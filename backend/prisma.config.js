// Configuração do Prisma CLI (ADR-0002). O Prisma 7 não lê o .env sozinho.
require('dotenv').config({ quiet: true });

const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    // Valor padrão permite rodar `prisma generate` (ex.: no CI) sem .env.
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
});
