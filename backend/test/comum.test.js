const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { prisma, limparBanco, encerrarBanco } = require('./ajuda/banco');
const app = require('../src/app');
const { identificarUsuario, exigirUsuario, exigirPapel } = require('../src/comum/identificacao');
const { rotaNaoEncontrada, tratarErros } = require('../src/comum/tratamentoErros');
const { conflito } = require('../src/comum/erros');

// App mínimo com rotas de exemplo para exercitar os middlewares.
const appTeste = express();
appTeste.use(express.json());
appTeste.use(identificarUsuario);
appTeste.get('/publica', (req, res) => res.json({ usuario: req.usuario?.nome ?? null }));
appTeste.get('/identificada', exigirUsuario, (req, res) => res.json({ usuario: req.usuario.nome }));
appTeste.get('/monitor', exigirPapel('MONITOR'), (req, res) => res.json({ ok: true }));
appTeste.get('/conflito', () => {
  throw conflito('SESSAO_SEM_VAGAS', 'Não há vagas disponíveis nesta sessão.');
});
appTeste.get('/assincrono', async () => {
  throw conflito('AGENDAMENTO_DUPLICADO', 'Aluno já agendado nesta sessão.');
});
appTeste.get('/inesperado', () => {
  throw new Error('detalhe interno que não deve vazar');
});
appTeste.post('/eco', (req, res) => res.json(req.body));
appTeste.use(rotaNaoEncontrada);
appTeste.use(tratarErros);

let aluno;
let monitor;

before(async () => {
  await limparBanco();
  aluno = await prisma.usuario.create({ data: { nome: 'Ana', email: 'ana@teste.br', papel: 'ALUNO' } });
  monitor = await prisma.usuario.create({ data: { nome: 'Carla', email: 'carla@teste.br', papel: 'MONITOR' } });
});

after(encerrarBanco);

function assertErro(resposta, status, codigo) {
  assert.equal(resposta.status, status);
  assert.equal(resposta.body.erro.codigo, codigo);
  assert.equal(typeof resposta.body.erro.mensagem, 'string');
}

test('rota pública sem cabeçalho: req.usuario é null', async () => {
  const resposta = await request(appTeste).get('/publica');
  assert.equal(resposta.status, 200);
  assert.deepEqual(resposta.body, { usuario: null });
});

test('cabeçalho válido anexa o usuário em req.usuario', async () => {
  const resposta = await request(appTeste).get('/publica').set('X-Usuario-Id', String(aluno.id));
  assert.deepEqual(resposta.body, { usuario: 'Ana' });
});

test('cabeçalho com usuário inexistente responde 401', async () => {
  const resposta = await request(appTeste).get('/publica').set('X-Usuario-Id', '999999');
  assertErro(resposta, 401, 'USUARIO_NAO_ENCONTRADO');
});

test('cabeçalho com id inválido responde 401', async () => {
  for (const valor of ['abc', '0', '-1', '1.5', '']) {
    const resposta = await request(appTeste).get('/publica').set('X-Usuario-Id', valor);
    assertErro(resposta, 401, 'USUARIO_NAO_ENCONTRADO');
  }
});

test('exigirUsuario sem cabeçalho responde 401', async () => {
  const resposta = await request(appTeste).get('/identificada');
  assertErro(resposta, 401, 'IDENTIFICACAO_OBRIGATORIA');
});

test('exigirPapel: papel permitido passa', async () => {
  const resposta = await request(appTeste).get('/monitor').set('X-Usuario-Id', String(monitor.id));
  assert.equal(resposta.status, 200);
});

test('exigirPapel: outro papel responde 403', async () => {
  const resposta = await request(appTeste).get('/monitor').set('X-Usuario-Id', String(aluno.id));
  assertErro(resposta, 403, 'PAPEL_NAO_PERMITIDO');
});

test('exigirPapel sem cabeçalho responde 401', async () => {
  const resposta = await request(appTeste).get('/monitor');
  assertErro(resposta, 401, 'IDENTIFICACAO_OBRIGATORIA');
});

test('ErroApi vira resposta no formato padrão', async () => {
  const resposta = await request(appTeste).get('/conflito');
  assert.deepEqual(resposta.body, {
    erro: { codigo: 'SESSAO_SEM_VAGAS', mensagem: 'Não há vagas disponíveis nesta sessão.' },
  });
  assert.equal(resposta.status, 409);
});

test('erro lançado em handler assíncrono também é tratado', async () => {
  const resposta = await request(appTeste).get('/assincrono');
  assertErro(resposta, 409, 'AGENDAMENTO_DUPLICADO');
});

test('erro inesperado responde 500 sem vazar detalhes', async (t) => {
  t.mock.method(console, 'error', () => {});
  const resposta = await request(appTeste).get('/inesperado');
  assertErro(resposta, 500, 'ERRO_INTERNO');
  assert.doesNotMatch(JSON.stringify(resposta.body), /detalhe interno/);
});

test('JSON malformado responde 400', async () => {
  const resposta = await request(appTeste)
    .post('/eco')
    .set('Content-Type', 'application/json')
    .send('{"quebrado":');
  assertErro(resposta, 400, 'JSON_INVALIDO');
});

test('app real: rota inexistente responde 404 no formato padrão', async () => {
  const resposta = await request(app).get('/rota-que-nao-existe');
  assertErro(resposta, 404, 'ROTA_NAO_ENCONTRADA');
});

test('app real: /health não depende de identificação', async () => {
  const resposta = await request(app).get('/health').set('X-Usuario-Id', '999999');
  assert.equal(resposta.status, 200);
});
