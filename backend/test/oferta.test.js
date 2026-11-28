const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { prisma, limparBanco, encerrarBanco } = require('./ajuda/banco');
const { criarUsuario, criarOfertaComSessoes, agendar } = require('./ajuda/fabrica');
const app = require('../src/app');
const { hoje, somarDias, somarMeses, diaSemana } = require('../src/comum/datas');
const { gerarSessoes } = require('../src/oferta/geracaoSessoes');

let monitor;
let outroMonitor;
let aluno;

beforeEach(async () => {
  await limparBanco();
  monitor = await criarUsuario('MONITOR', 'Carla');
  outroMonitor = await criarUsuario('MONITOR', 'Diego');
  aluno = await criarUsuario('ALUNO', 'Ana');
});
after(encerrarBanco);

const como = (usuario) => ({ 'X-Usuario-Id': String(usuario.id) });

function assertErro(resposta, status, codigo) {
  assert.equal(resposta.status, status, JSON.stringify(resposta.body));
  assert.equal(resposta.body.erro.codigo, codigo);
}

// Primeiro dia a partir de amanhã que não é domingo (domingo não é dia de oferta).
function proximoDiaUtil() {
  const amanha = somarDias(hoje(), 1);
  return diaSemana(amanha) === 'DOM' ? somarDias(amanha, 1) : amanha;
}

// Corpo válido: 4 semanas a partir do próximo dia útil, no dia da semana dele.
function novaOferta(sobrescrever = {}) {
  const amanha = proximoDiaUtil();
  return {
    disciplina: 'Algoritmos e Estruturas de Dados I',
    codigoDisciplina: 'gcc216',
    descricao: 'Monitoria semanal',
    local: 'DCC - Sala 105',
    vagas: 10,
    dataInicio: amanha,
    dataFim: somarDias(amanha, 27),
    horarios: [{ diaSemana: diaSemana(amanha), horaInicio: '14:00', horaFim: '16:00' }],
    ...sobrescrever,
  };
}

describe('geração de sessões', () => {
  test('gera uma sessão por horário em cada semana, no fuso de Brasília', () => {
    const sessoes = gerarSessoes({
      dataInicio: '2026-11-30', // segunda
      dataFim: '2026-12-13',
      vagas: 5,
      horarios: [
        { diaSemana: 'TER', horaInicio: '14:00', horaFim: '16:00' },
        { diaSemana: 'QUI', horaInicio: '19:00', horaFim: '20:30' },
      ],
    });
    assert.deepEqual(
      sessoes.map((s) => [s.inicio.toISOString(), s.fim.toISOString()]),
      [
        ['2026-12-01T17:00:00.000Z', '2026-12-01T19:00:00.000Z'],
        ['2026-12-03T22:00:00.000Z', '2026-12-03T23:30:00.000Z'],
        ['2026-12-08T17:00:00.000Z', '2026-12-08T19:00:00.000Z'],
        ['2026-12-10T22:00:00.000Z', '2026-12-10T23:30:00.000Z'],
      ],
    );
  });

  test('atravessa a virada de mês e de ano', () => {
    const sessoes = gerarSessoes({
      dataInicio: '2026-12-28',
      dataFim: '2027-01-08',
      vagas: 1,
      horarios: [{ diaSemana: 'SEG', horaInicio: '08:00', horaFim: '10:00' }],
    });
    assert.deepEqual(sessoes.map((s) => s.inicio.toISOString()), ['2026-12-28T11:00:00.000Z', '2027-01-04T11:00:00.000Z']);
  });

  test('descarta sessões anteriores a aPartirDe', () => {
    const sessoes = gerarSessoes({
      dataInicio: '2026-12-01',
      dataFim: '2026-12-08',
      vagas: 1,
      horarios: [{ diaSemana: 'TER', horaInicio: '14:00', horaFim: '16:00' }],
      aPartirDe: new Date('2026-12-01T18:00:00Z'),
    });
    assert.equal(sessoes.length, 1);
  });
});

describe('POST /ofertas', () => {
  test('cria a oferta, gera as sessões e responde 201', async () => {
    const resposta = await request(app).post('/ofertas').set(como(monitor)).send(novaOferta());

    assert.equal(resposta.status, 201, JSON.stringify(resposta.body));
    assert.equal(resposta.body.totalSessoes, 4);
    assert.equal(resposta.body.codigoDisciplina, 'GCC216');
    assert.equal(resposta.body.status, 'ABERTA');
    assert.deepEqual(resposta.body.monitor, { id: monitor.id, nome: 'Carla' });
    assert.equal(await prisma.sessao.count({ where: { ofertaId: resposta.body.id } }), 4);
  });

  test('exige monitor identificado', async () => {
    assertErro(await request(app).post('/ofertas').send(novaOferta()), 401, 'IDENTIFICACAO_OBRIGATORIA');
    assertErro(await request(app).post('/ofertas').set(como(aluno)).send(novaOferta()), 403, 'PAPEL_NAO_PERMITIDO');
  });

  test('valida período e horários com 400', async () => {
    const amanha = proximoDiaUtil();
    const invalidos = [
      novaOferta({ dataInicio: somarDias(hoje(), -1) }),
      novaOferta({ dataFim: somarDias(amanha, -1) }),
      novaOferta({ dataFim: somarDias(somarMeses(amanha, 6), 1) }),
      novaOferta({ dataInicio: '2026-02-30' }),
      novaOferta({ horarios: [] }),
      novaOferta({ horarios: [{ diaSemana: 'DOM', horaInicio: '14:00', horaFim: '16:00' }] }),
      novaOferta({ horarios: [{ diaSemana: 'TER', horaInicio: '16:00', horaFim: '14:00' }] }),
      novaOferta({ horarios: [{ diaSemana: 'TER', horaInicio: '25:00', horaFim: '26:00' }] }),
      novaOferta({
        horarios: [
          { diaSemana: 'TER', horaInicio: '14:00', horaFim: '16:00' },
          { diaSemana: 'TER', horaInicio: '15:00', horaFim: '17:00' },
        ],
      }),
      novaOferta({ vagas: 0 }),
      novaOferta({ disciplina: '' }),
    ];
    for (const corpo of invalidos) {
      assertErro(await request(app).post('/ofertas').set(como(monitor)).send(corpo), 400, 'DADOS_INVALIDOS');
    }
  });

  test('aceita o limite de 6 meses e horários encostados', async () => {
    const amanha = proximoDiaUtil();
    const resposta = await request(app)
      .post('/ofertas')
      .set(como(monitor))
      .send(novaOferta({
        dataFim: somarMeses(amanha, 6),
        horarios: [
          { diaSemana: 'TER', horaInicio: '14:00', horaFim: '16:00' },
          { diaSemana: 'TER', horaInicio: '16:00', horaFim: '18:00' },
        ],
      }));
    assert.equal(resposta.status, 201, JSON.stringify(resposta.body));
  });

  test('período sem nenhuma sessão responde 400 PERIODO_SEM_SESSOES', async () => {
    const amanha = proximoDiaUtil();
    const outroDia = diaSemana(somarDias(amanha, 1)) === 'DOM' ? diaSemana(somarDias(amanha, 2)) : diaSemana(somarDias(amanha, 1));
    const resposta = await request(app)
      .post('/ofertas')
      .set(como(monitor))
      .send(novaOferta({ dataFim: amanha, horarios: [{ diaSemana: outroDia, horaInicio: '14:00', horaFim: '16:00' }] }));
    assertErro(resposta, 400, 'PERIODO_SEM_SESSOES');
  });
});

describe('consulta de ofertas e sessões', () => {
  test('GET /ofertas lista com filtros e próxima sessão', async () => {
    const aed = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-48, 24, 72] });
    await criarOfertaComSessoes(outroMonitor, { codigoDisciplina: 'GEX104', disciplina: 'Cálculo I', status: 'ENCERRADA' });
    await agendar(aed.sessoes[1], aluno);

    const todas = await request(app).get('/ofertas');
    assert.equal(todas.body.length, 2);

    const abertas = await request(app).get('/ofertas?status=ABERTA');
    assert.deepEqual(abertas.body.map((o) => o.id), [aed.id]);
    assert.equal(abertas.body[0].proximaSessao.id, aed.sessoes[1].id);
    assert.equal(abertas.body[0].proximaSessao.vagasDisponiveis, 1);

    assert.equal((await request(app).get('/ofertas?codigoDisciplina=gex104')).body.length, 1);
    assert.equal((await request(app).get(`/ofertas?monitorId=${monitor.id}`)).body.length, 1);
    assertErro(await request(app).get('/ofertas?status=OUTRO'), 400, 'DADOS_INVALIDOS');
  });

  test('GET /ofertas/:id detalha com horários ou responde 404', async () => {
    const oferta = await criarOfertaComSessoes(monitor);
    const resposta = await request(app).get(`/ofertas/${oferta.id}`);

    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.body.horarios, [{ diaSemana: 'TER', horaInicio: '14:00', horaFim: '16:00' }]);
    assert.equal(resposta.body.proximaSessao.id, oferta.sessoes[0].id);
    assertErro(await request(app).get(`/ofertas/${oferta.id + 99}`), 404, 'OFERTA_NAO_ENCONTRADA');
  });

  test('GET /ofertas/:id/sessoes lista futuras sem nomes; ?desde inclui passadas', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-72, 24, 72] });
    await agendar(oferta.sessoes[1], aluno);
    await agendar(oferta.sessoes[1], await criarUsuario('ALUNO'), 'CANCELADO');

    const futuras = await request(app).get(`/ofertas/${oferta.id}/sessoes`);
    assert.equal(futuras.body.length, 2);
    assert.equal(futuras.body[0].vagasDisponiveis, 1);
    assert.equal(futuras.body[0].agendados, undefined);
    assert.equal(futuras.body[0].agendamentos, undefined);

    const desde = await request(app).get(`/ofertas/${oferta.id}/sessoes?desde=${somarDias(hoje(), -7)}`);
    assert.equal(desde.body.length, 3);

    assertErro(await request(app).get(`/ofertas/${oferta.id}/sessoes?desde=ontem`), 400, 'DADOS_INVALIDOS');
    assertErro(await request(app).get(`/ofertas/${oferta.id + 99}/sessoes`), 404, 'OFERTA_NAO_ENCONTRADA');
  });
});

describe('PATCH /ofertas/:id', () => {
  test('monitor dono altera descrição, local e vagas das sessões futuras', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-48, 24] });
    const resposta = await request(app)
      .patch(`/ofertas/${oferta.id}`)
      .set(como(monitor))
      .send({ descricao: 'Nova', local: 'Sala 200', vagas: 5 });

    assert.equal(resposta.status, 200, JSON.stringify(resposta.body));
    assert.equal(resposta.body.local, 'Sala 200');
    assert.equal(resposta.body.vagas, 5);
    const [passada, futura] = await prisma.sessao.findMany({ where: { ofertaId: oferta.id }, orderBy: { inicio: 'asc' } });
    assert.equal(passada.vagas, 2);
    assert.equal(futura.vagas, 5);
  });

  test('vagas menores que os agendamentos de uma sessão futura: 409 VAGAS_INSUFICIENTES', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { vagas: 3 });
    await agendar(oferta.sessoes[0], aluno);
    await agendar(oferta.sessoes[0], await criarUsuario('ALUNO'));

    const resposta = await request(app).patch(`/ofertas/${oferta.id}`).set(como(monitor)).send({ vagas: 1 });
    assertErro(resposta, 409, 'VAGAS_INSUFICIENTES');
  });

  test('rejeita campos não editáveis, outro monitor e oferta inexistente', async () => {
    const oferta = await criarOfertaComSessoes(monitor);
    const patch = (usuario, corpo, id = oferta.id) => request(app).patch(`/ofertas/${id}`).set(como(usuario)).send(corpo);

    assertErro(await patch(monitor, { dataFim: '2027-01-01' }), 400, 'DADOS_INVALIDOS');
    assertErro(await patch(monitor, { horarios: [] }), 400, 'DADOS_INVALIDOS');
    assertErro(await patch(monitor, {}), 400, 'DADOS_INVALIDOS');
    assertErro(await patch(monitor, { status: 'ABERTA' }), 400, 'DADOS_INVALIDOS');
    assertErro(await patch(monitor, { status: 'ENCERRADA', local: 'x' }), 400, 'DADOS_INVALIDOS');
    assertErro(await patch(outroMonitor, { local: 'x' }), 403, 'ACESSO_NEGADO');
    assertErro(await patch(aluno, { local: 'x' }), 403, 'PAPEL_NAO_PERMITIDO');
    assertErro(await patch(monitor, { local: 'x' }, oferta.id + 99), 404, 'OFERTA_NAO_ENCONTRADA');
  });

  test('encerrar cancela sessões futuras e seus agendamentos e preserva o passado', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-48, 24] });
    const [passada, futura] = oferta.sessoes;
    const realizado = await agendar(passada, aluno, 'REALIZADO');
    const agendado = await agendar(futura, aluno);

    const resposta = await request(app).patch(`/ofertas/${oferta.id}`).set(como(monitor)).send({ status: 'ENCERRADA' });

    assert.equal(resposta.status, 200, JSON.stringify(resposta.body));
    assert.equal(resposta.body.status, 'ENCERRADA');
    assert.equal(resposta.body.proximaSessao, null);
    assert.equal((await prisma.sessao.findUnique({ where: { id: passada.id } })).status, 'PREVISTA');
    assert.equal((await prisma.sessao.findUnique({ where: { id: futura.id } })).status, 'CANCELADA');
    assert.equal((await prisma.agendamento.findUnique({ where: { id: realizado.id } })).status, 'REALIZADO');
    assert.equal((await prisma.agendamento.findUnique({ where: { id: agendado.id } })).status, 'CANCELADO');

    const deNovo = await request(app).patch(`/ofertas/${oferta.id}`).set(como(monitor)).send({ local: 'x' });
    assertErro(deNovo, 409, 'OFERTA_ENCERRADA');
  });
});

describe('sessões', () => {
  test('GET /sessoes/:id: monitor dono vê agendamentos completos', async () => {
    const oferta = await criarOfertaComSessoes(monitor);
    const sessao = oferta.sessoes[0];
    await agendar(sessao, aluno);
    await agendar(sessao, await criarUsuario('ALUNO', 'Bruno'), 'CANCELADO');

    const resposta = await request(app).get(`/sessoes/${sessao.id}`).set(como(monitor));

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.vagasDisponiveis, 1);
    assert.equal(resposta.body.agendados, undefined);
    assert.deepEqual(
      resposta.body.agendamentos.map((a) => [a.aluno.nome, a.status, typeof a.aluno.email]),
      [['Ana', 'AGENDADO', 'string'], ['Bruno', 'CANCELADO', 'string']],
    );
  });

  test('GET /sessoes/:id: demais usuários veem só os nomes dos agendados', async () => {
    const oferta = await criarOfertaComSessoes(monitor);
    const sessao = oferta.sessoes[0];
    await agendar(sessao, aluno);
    await agendar(sessao, await criarUsuario('ALUNO', 'Bruno'), 'CANCELADO');

    for (const usuario of [aluno, outroMonitor, await criarUsuario('ALUNO')]) {
      const resposta = await request(app).get(`/sessoes/${sessao.id}`).set(como(usuario));
      assert.deepEqual(resposta.body.agendados, ['Ana']);
      assert.equal(resposta.body.agendamentos, undefined);
    }
  });

  test('GET /sessoes/:id exige identificação e responde 404 para inexistente', async () => {
    const oferta = await criarOfertaComSessoes(monitor);
    assertErro(await request(app).get(`/sessoes/${oferta.sessoes[0].id}`), 401, 'IDENTIFICACAO_OBRIGATORIA');
    assertErro(await request(app).get('/sessoes/999999').set(como(aluno)), 404, 'SESSAO_NAO_ENCONTRADA');
  });

  test('PATCH /sessoes/:id/cancelar cancela a sessão e seus agendamentos', async () => {
    const oferta = await criarOfertaComSessoes(monitor);
    const sessao = oferta.sessoes[0];
    const agendamento = await agendar(sessao, aluno);

    const resposta = await request(app).patch(`/sessoes/${sessao.id}/cancelar`).set(como(monitor));

    assert.equal(resposta.status, 200, JSON.stringify(resposta.body));
    assert.equal(resposta.body.status, 'CANCELADA');
    assert.equal((await prisma.agendamento.findUnique({ where: { id: agendamento.id } })).status, 'CANCELADO');
    assert.equal((await prisma.sessao.findUnique({ where: { id: oferta.sessoes[1].id } })).status, 'PREVISTA');
  });

  test('PATCH /sessoes/:id/cancelar: regras de permissão e de estado', async () => {
    const oferta = await criarOfertaComSessoes(monitor, { horasAPartirDeAgora: [-1, 24] });
    const [iniciada, futura] = oferta.sessoes;
    const cancelar = (sessao, usuario) => request(app).patch(`/sessoes/${sessao.id}/cancelar`).set(como(usuario));

    assertErro(await cancelar(futura, outroMonitor), 403, 'ACESSO_NEGADO');
    assertErro(await cancelar(futura, aluno), 403, 'PAPEL_NAO_PERMITIDO');
    assertErro(await cancelar(iniciada, monitor), 409, 'SESSAO_NAO_CANCELAVEL');
    assert.equal((await cancelar(futura, monitor)).status, 200);
    assertErro(await cancelar(futura, monitor), 409, 'SESSAO_NAO_CANCELAVEL');
  });
});
