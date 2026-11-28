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

const registrar = (usuario, corpo) => request(app).post('/frequencias').set(como(usuario)).send(corpo);

describe('POST /frequencias', () => {
  test('monitor dono registra presença e o agendamento vira REALIZADO', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-3] });
    const agendamento = await agendar(oferta.sessoes[0], aluno);

    const resposta = await registrar(monitor, { agendamentoId: agendamento.id, presente: true, observacao: ' Revisou AVL ' });

    assert.equal(resposta.status, 201, JSON.stringify(resposta.body));
    assert.equal(resposta.body.presente, true);
    assert.equal(resposta.body.observacao, 'Revisou AVL');
    assert.equal((await prisma.agendamento.findUnique({ where: { id: agendamento.id } })).status, 'REALIZADO');
  });

  test('registra falta sem observação', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-1] });
    const agendamento = await agendar(oferta.sessoes[0], aluno);

    const resposta = await registrar(monitor, { agendamentoId: agendamento.id, presente: false });

    assert.equal(resposta.status, 201, JSON.stringify(resposta.body));
    assert.equal(resposta.body.presente, false);
    assert.equal(resposta.body.observacao, null);
  });

  test('regras de permissão, validação e estado', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-3, 24] });
    const [passada, futura] = oferta.sessoes;
    const ativo = await agendar(passada, aluno);
    const cancelado = await agendar(passada, outroAluno, 'CANCELADO');
    const naoIniciado = await agendar(futura, aluno);

    assertErro(await registrar(outroMonitor, { agendamentoId: ativo.id, presente: true }), 403, 'ACESSO_NEGADO');
    assertErro(await registrar(aluno, { agendamentoId: ativo.id, presente: true }), 403, 'PAPEL_NAO_PERMITIDO');
    assertErro(await registrar(monitor, { agendamentoId: ativo.id, presente: 'sim' }), 400, 'DADOS_INVALIDOS');
    assertErro(await registrar(monitor, { presente: true }), 400, 'DADOS_INVALIDOS');
    assertErro(await registrar(monitor, { agendamentoId: 999999, presente: true }), 404, 'AGENDAMENTO_NAO_ENCONTRADO');
    assertErro(await registrar(monitor, { agendamentoId: naoIniciado.id, presente: true }), 409, 'SESSAO_NAO_INICIADA');
    assertErro(await registrar(monitor, { agendamentoId: cancelado.id, presente: true }), 409, 'AGENDAMENTO_NAO_ATIVO');

    assert.equal((await registrar(monitor, { agendamentoId: ativo.id, presente: true })).status, 201);
    assertErro(await registrar(monitor, { agendamentoId: ativo.id, presente: false }), 409, 'FREQUENCIA_JA_REGISTRADA');
  });
});

describe('GET /frequencias', () => {
  async function cenario() {
    const aed = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-72, -24] });
    const outra = await criarOfertaComSessoes(outroMonitor, { horasAPartirDeAgora: [-48], codigoDisciplina: 'GEX104' });
    for (const [sessao, alunoDaVez, presente] of [
      [aed.sessoes[0], aluno, true],
      [aed.sessoes[1], aluno, false],
      [aed.sessoes[1], outroAluno, true],
      [outra.sessoes[0], aluno, true],
    ]) {
      const agendamento = await agendar(sessao, alunoDaVez, 'REALIZADO');
      await prisma.frequencia.create({ data: { agendamentoId: agendamento.id, presente } });
    }
    return { aed, outra };
  }

  test('aluno vê o seu histórico com sessão e oferta', async () => {
    await cenario();
    const resposta = await request(app).get('/frequencias').set(como(aluno));

    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.body.map((f) => [f.oferta.codigoDisciplina, f.presente]), [
      ['GCC216', true],
      ['GEX104', true],
      ['GCC216', false],
    ]);
    assert.equal(typeof resposta.body[0].sessao.inicio, 'string');
  });

  test('monitor filtra por sessão ou por oferta sua', async () => {
    const { aed, outra } = await cenario();
    const listar = (usuario, query = '') => request(app).get(`/frequencias${query}`).set(como(usuario));

    const porOferta = await listar(monitor, `?ofertaId=${aed.id}`);
    assert.equal(porOferta.status, 200);
    assert.deepEqual(porOferta.body.map((f) => f.aluno.nome), ['Ana', 'Ana', 'Bruno']);

    const porSessao = await listar(monitor, `?sessaoId=${aed.sessoes[1].id}`);
    assert.deepEqual(porSessao.body.map((f) => [f.aluno.nome, f.presente]), [['Ana', false], ['Bruno', true]]);

    assertErro(await listar(monitor), 400, 'DADOS_INVALIDOS');
    assertErro(await listar(monitor, `?ofertaId=${outra.id}`), 403, 'ACESSO_NEGADO');
    assertErro(await listar(monitor, '?sessaoId=999999'), 404, 'SESSAO_NAO_ENCONTRADA');
    assertErro(await listar(monitor, '?ofertaId=999999'), 404, 'OFERTA_NAO_ENCONTRADA');
    assertErro(await request(app).get('/frequencias'), 401, 'IDENTIFICACAO_OBRIGATORIA');
  });
});
