// Banco SQLite isolado para testes: cada arquivo de teste roda em um processo próprio
// e recebe um banco temporário com as migrations aplicadas.
// Importe ANTES de `src/app` ou `src/comum/prisma`, para que eles usem este banco.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const arquivo = path.join(os.tmpdir(), `monitoria-teste-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${arquivo.replaceAll('\\', '/')}`;

execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
  cwd: path.join(__dirname, '..', '..'),
  env: process.env,
  stdio: 'ignore',
});

const prisma = require('../../src/comum/prisma');

async function limparBanco() {
  await prisma.frequencia.deleteMany();
  await prisma.agendamento.deleteMany();
  await prisma.sessao.deleteMany();
  await prisma.horario.deleteMany();
  await prisma.oferta.deleteMany();
  await prisma.usuario.deleteMany();
}

async function encerrarBanco() {
  await prisma.$disconnect();
  fs.rmSync(arquivo, { force: true });
}

module.exports = { prisma, limparBanco, encerrarBanco };
