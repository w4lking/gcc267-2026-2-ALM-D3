const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');

test('GET /health responde 200 com status ok', async () => {
  const resposta = await request(app).get('/health');

  assert.equal(resposta.status, 200);
  assert.match(resposta.headers['content-type'], /application\/json/);
  assert.deepEqual(resposta.body, { status: 'ok' });
});

test('rota inexistente responde 404', async () => {
  const resposta = await request(app).get('/rota-que-nao-existe');

  assert.equal(resposta.status, 404);
});
