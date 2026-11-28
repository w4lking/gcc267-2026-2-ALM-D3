const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { prisma, limparBanco, encerrarBanco } = require('./ajuda/banco');
const { criarUsuario, criarOfertaComSessoes, agendar } = require('./ajuda/fabrica');
const app = require('../src/app');

let monitor;
let outroMonitor;
let aluno;
let outroAluno;

beforeEach(async () => {
  await limparBanco();
  monitor = await criarUsuario('MONITOR', 'Carla');
  outroMonitor = await criarUsuario('MONITOR', 'Diego');
  aluno = await criarUsuario('ALUNO', 'Ana');
  outroAluno = await criarUsuario('ALUNO', 'Bruno');
});
after(encerrarBanco);

const como = (usuario) => ({ 'X-Usuario-Id': String(usuario.id) });

function assertErro(resposta, status, codigo) {
  assert.equal(resposta.status, status, JSON.stringify(resposta.body));
  assert.equal(resposta.body.erro.codigo, codigo);
}

const agendarVia = (usuario, sessaoId) =>
  request(app).post('/agendamentos').set(como(usuario)).send({ sessaoId });

describe('POST /agendamentos', () => {
  test('agenda o aluno do cabeçalho e ocupa uma vaga', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { vagas: 2 });
    const sessao = oferta.sessoes[0];

    const resposta = await agendarVia(aluno, sessao.id);

    assert.equal(resposta.status, 201, JSON.stringify(resposta.body));
    assert.equal(resposta.body.status, 'AGENDADO');
    assert.equal(resposta.body.alunoId, aluno.id);
    const sessaoDepois = await request(app).get(`/ofertas/${oferta.id}/sessoes`);
    assert.equal(sessaoDepois.body[0].vagasDisponiveis, 1);
  });

  test('exige aluno identificado e sessaoId válido', async () => {
    const oferta = await criarOfertaComSessoes(monitor);
    assertErro(await request(app).post('/agendamentos').send({ sessaoId: 1 }), 401, 'IDENTIFICACAO_OBRIGATORIA');
    assertErro(await agendarVia(monitor, oferta.sessoes[0].id), 403, 'PAPEL_NAO_PERMITIDO');
    assertErro(await agendarVia(aluno, 'abc'), 400, 'DADOS_INVALIDOS');
    assertErro(await agendarVia(aluno, 999999), 404, 'SESSAO_NAO_ENCONTRADA');
  });

  test('sessão cancelada, iniciada ou de oferta encerrada: 409 SESSAO_INDISPONIVEL', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-1, 24, 48] });
    const [iniciada, cancelada] = oferta.sessoes;
    await prisma.sessao.update({ where: { id: cancelada.id }, data: { status: 'CANCELADA' } });
    const encerrada = await criarOfertaComSessoes(monitor, { status: 'ENCERRADA' });

    assertErro(await agendarVia(aluno, iniciada.id), 409, 'SESSAO_INDISPONIVEL');
    assertErro(await agendarVia(aluno, cancelada.id), 409, 'SESSAO_INDISPONIVEL');
    assertErro(await agendarVia(aluno, encerrada.sessoes[0].id), 409, 'SESSAO_INDISPONIVEL');
  });

  test('aluno já agendado: 409 AGENDAMENTO_DUPLICADO; após cancelar, pode agendar de novo', async () => {
    const oferta = await criarOfertaComSessoes(monitor);
    const sessao = oferta.sessoes[0];

    const primeiro = await agendarVia(aluno, sessao.id);
    assertErro(await agendarVia(aluno, sessao.id), 409, 'AGENDAMENTO_DUPLICADO');

    await request(app).patch(`/agendamentos/${primeiro.body.id}/cancelar`).set(como(aluno));
    assert.equal((await agendarVia(aluno, sessao.id)).status, 201);
  });

  test('sessão lotada: 409 SESSAO_SEM_VAGAS; cancelamentos não ocupam vaga', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { vagas: 1 });
    const sessao = oferta.sessoes[0];
    await agendar(sessao, await criarUsuario('ALUNO'), 'CANCELADO');

    assert.equal((await agendarVia(aluno, sessao.id)).status, 201);
    assertErro(await agendarVia(outroAluno, sessao.id), 409, 'SESSAO_SEM_VAGAS');
  });

  test('reservas simultâneas não ultrapassam as vagas', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { vagas: 2 });
    const sessao = oferta.sessoes[0];
    const alunos = await Promise.all(Array.from({ length: 6 }, () => criarUsuario('ALUNO')));

    const respostas = await Promise.all(alunos.map((a) => agendarVia(a, sessao.id)));

    assert.equal(respostas.filter((r) => r.status === 201).length, 2);
    assert.ok(respostas.filter((r) => r.status !== 201).every((r) => r.body.erro.codigo === 'SESSAO_SEM_VAGAS'));
    assert.equal(await prisma.agendamento.count({ where: { sessaoId: sessao.id, status: 'AGENDADO' } }), 2);
  });
});

describe('GET /agendamentos', () => {
  test('aluno vê só os seus, com sessão, oferta e frequência', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-48, 24] });
    const [passada, futura] = oferta.sessoes;
    const realizado = await agendar(passada, aluno, 'REALIZADO');
    await prisma.frequencia.create({ data: { agendamentoId: realizado.id, presente: true } });
    await agendar(futura, aluno);
    await agendar(futura, outroAluno);

    const resposta = await request(app).get('/agendamentos').set(como(aluno));

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.length, 2);
    assert.equal(resposta.body[0].sessao.id, passada.id);
    assert.equal(resposta.body[0].frequencia.presente, true);
    assert.deepEqual(resposta.body[1].oferta.monitor, { id: monitor.id, nome: 'Carla' });
    assert.equal(resposta.body[1].frequencia, null);
  });

  test('monitor dono vê os agendamentos da sessão com dados do aluno', async () => {
    const oferta = await criarOfertaComSessoes(monitor);
    const sessao = oferta.sessoes[0];
    await agendar(sessao, aluno);
    await agendar(sessao, outroAluno, 'CANCELADO');

    const resposta = await request(app).get(`/agendamentos?sessaoId=${sessao.id}`).set(como(monitor));

    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.body.map((a) => [a.aluno.nome, a.status]), [['Ana', 'AGENDADO'], ['Bruno', 'CANCELADO']]);
  });

  test('monitor: exige sessaoId de oferta sua', async () => {
    const oferta = await criarOfertaComSessoes(monitor);
    const listar = (usuario, query = '') => request(app).get(`/agendamentos${query}`).set(como(usuario));

    assertErro(await listar(monitor), 400, 'DADOS_INVALIDOS');
    assertErro(await listar(outroMonitor, `?sessaoId=${oferta.sessoes[0].id}`), 403, 'ACESSO_NEGADO');
    assertErro(await listar(monitor, '?sessaoId=999999'), 404, 'SESSAO_NAO_ENCONTRADA');
    assertErro(await request(app).get('/agendamentos'), 401, 'IDENTIFICACAO_OBRIGATORIA');
  });
});

describe('PATCH /agendamentos/:id/cancelar', () => {
  test('aluno dono cancela antes do início e libera a vaga', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { vagas: 1 });
    const agendamento = await agendar(oferta.sessoes[0], aluno);

    const resposta = await request(app).patch(`/agendamentos/${agendamento.id}/cancelar`).set(como(aluno));

    assert.equal(resposta.status, 200, JSON.stringify(resposta.body));
    assert.equal(resposta.body.status, 'CANCELADO');
    assert.equal((await agendarVia(outroAluno, oferta.sessoes[0].id)).status, 201);
  });

  test('regras de permissão e de estado', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-1, 24] });
    const [iniciada, futura] = oferta.sessoes;
    const deIniciada = await agendar(iniciada, aluno);
    const cancelado = await agendar(futura, aluno, 'CANCELADO');
    const ativo = await agendar(futura, outroAluno);
    const cancelar = (agendamento, usuario) =>
      request(app).patch(`/agendamentos/${agendamento.id}/cancelar`).set(como(usuario));

    assertErro(await cancelar(ativo, aluno), 403, 'ACESSO_NEGADO');
    assertErro(await cancelar(ativo, monitor), 403, 'PAPEL_NAO_PERMITIDO');
    assertErro(await cancelar(deIniciada, aluno), 409, 'AGENDAMENTO_NAO_CANCELAVEL');
    assertErro(await cancelar(cancelado, aluno), 409, 'AGENDAMENTO_NAO_CANCELAVEL');
    assertErro(await cancelar({ id: 999999 }, aluno), 404, 'AGENDAMENTO_NAO_ENCONTRADO');
  });
});
