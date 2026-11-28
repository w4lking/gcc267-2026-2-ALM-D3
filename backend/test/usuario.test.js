const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { prisma, limparBanco, encerrarBanco } = require('./ajuda/banco');
const app = require('../src/app');

beforeEach(limparBanco);
after(encerrarBanco);

function assertErro(resposta, status, codigo) {
  assert.equal(resposta.status, status);
  assert.equal(resposta.body.erro.codigo, codigo);
}

test('POST /usuarios cria usuário e responde 201', async () => {
  const resposta = await request(app)
    .post('/usuarios')
    .send({ nome: '  Ana Souza ', email: 'Ana@Estudante.UFLA.br', papel: 'ALUNO' });

  assert.equal(resposta.status, 201);
  assert.equal(typeof resposta.body.id, 'number');
  assert.deepEqual(
    { ...resposta.body, id: undefined },
    { id: undefined, nome: 'Ana Souza', email: 'ana@estudante.ufla.br', papel: 'ALUNO' },
  );
});

test('POST /usuarios com e-mail repetido responde 409 EMAIL_JA_CADASTRADO', async () => {
  await request(app).post('/usuarios').send({ nome: 'Ana', email: 'ana@ufla.br', papel: 'ALUNO' });
  const resposta = await request(app)
    .post('/usuarios')
    .send({ nome: 'Outra Ana', email: 'ANA@ufla.br', papel: 'MONITOR' });

  assertErro(resposta, 409, 'EMAIL_JA_CADASTRADO');
});

test('POST /usuarios valida os campos com 400 DADOS_INVALIDOS', async () => {
  const invalidos = [
    {},
    { email: 'ana@ufla.br', papel: 'ALUNO' },
    { nome: 'Ana', email: 'nao-e-email', papel: 'ALUNO' },
    { nome: 'Ana', email: 'ana@ufla.br', papel: 'PROFESSOR' },
    { nome: 123, email: 'ana@ufla.br', papel: 'ALUNO' },
  ];
  for (const corpo of invalidos) {
    assertErro(await request(app).post('/usuarios').send(corpo), 400, 'DADOS_INVALIDOS');
  }
});

test('POST /usuarios sem corpo responde 400', async () => {
  assertErro(await request(app).post('/usuarios'), 400, 'DADOS_INVALIDOS');
});

test('GET /usuarios lista em ordem alfabética e filtra por papel', async () => {
  await prisma.usuario.createMany({
    data: [
      { nome: 'Carla', email: 'carla@ufla.br', papel: 'MONITOR' },
      { nome: 'Ana', email: 'ana@ufla.br', papel: 'ALUNO' },
      { nome: 'Bruno', email: 'bruno@ufla.br', papel: 'ALUNO' },
    ],
  });

  const todos = await request(app).get('/usuarios');
  assert.deepEqual(todos.body.map((u) => u.nome), ['Ana', 'Bruno', 'Carla']);

  const monitores = await request(app).get('/usuarios?papel=MONITOR');
  assert.deepEqual(monitores.body.map((u) => u.nome), ['Carla']);

  assertErro(await request(app).get('/usuarios?papel=OUTRO'), 400, 'DADOS_INVALIDOS');
});

test('GET /usuarios/:id detalha ou responde 404', async () => {
  const ana = await prisma.usuario.create({ data: { nome: 'Ana', email: 'ana@ufla.br', papel: 'ALUNO' } });

  const resposta = await request(app).get(`/usuarios/${ana.id}`);
  assert.equal(resposta.status, 200);
  assert.equal(resposta.body.email, 'ana@ufla.br');
  assert.equal(resposta.body.criadoEm, undefined);

  assertErro(await request(app).get(`/usuarios/${ana.id + 100}`), 404, 'USUARIO_NAO_ENCONTRADO');
  assertErro(await request(app).get('/usuarios/abc'), 400, 'DADOS_INVALIDOS');
});
