// Contexto Oferta: ofertas recorrentes e suas sessões (docs/api.md, ADR-0004).

const prisma = require('../comum/prisma');
const { conflito, naoEncontrado, proibido, requisicaoInvalida } = require('../comum/erros');
const { instante } = require('../comum/datas');
const { gerarSessoes } = require('./geracaoSessoes');

// Conta só os agendamentos que ocupam vaga.
const CONTAR_AGENDADOS = { _count: { select: { agendamentos: { where: { status: 'AGENDADO' } } } } };

const INCLUIR_OFERTA = {
  monitor: { select: { id: true, nome: true } },
  horarios: { orderBy: { id: 'asc' } },
};

function formatarSessao(sessao) {
  return {
    id: sessao.id,
    ofertaId: sessao.ofertaId,
    inicio: sessao.inicio,
    fim: sessao.fim,
    vagas: sessao.vagas,
    vagasDisponiveis: sessao.vagas - sessao._count.agendamentos,
    status: sessao.status,
  };
}

function formatarOferta(oferta) {
  return {
    id: oferta.id,
    disciplina: oferta.disciplina,
    codigoDisciplina: oferta.codigoDisciplina,
    descricao: oferta.descricao,
    local: oferta.local,
    vagas: oferta.vagas,
    dataInicio: oferta.dataInicio,
    dataFim: oferta.dataFim,
    status: oferta.status,
    monitor: oferta.monitor,
    horarios: oferta.horarios.map(({ diaSemana, horaInicio, horaFim }) => ({ diaSemana, horaInicio, horaFim })),
  };
}

async function proximaSessao(ofertaId, agora) {
  const sessao = await prisma.sessao.findFirst({
    where: { ofertaId, status: 'PREVISTA', inicio: { gt: agora } },
    orderBy: { inicio: 'asc' },
    include: CONTAR_AGENDADOS,
  });
  return sessao ? formatarSessao(sessao) : null;
}

async function buscarOfertaOuFalhar(id) {
  const oferta = await prisma.oferta.findUnique({ where: { id }, include: INCLUIR_OFERTA });
  if (!oferta) {
    throw naoEncontrado('OFERTA_NAO_ENCONTRADA', 'Oferta não encontrada.');
  }
  return oferta;
}

function garantirDono(oferta, usuario) {
  if (oferta.monitorId !== usuario.id) {
    throw proibido('ACESSO_NEGADO', 'Apenas o monitor responsável pela oferta pode fazer isso.');
  }
}

async function criarOferta(monitor, dados, agora = new Date()) {
  const sessoes = gerarSessoes({ ...dados, aPartirDe: agora });
  if (sessoes.length === 0) {
    throw requisicaoInvalida('PERIODO_SEM_SESSOES', 'O período e os horários informados não geram nenhuma sessão.');
  }

  const oferta = await prisma.oferta.create({
    data: {
      disciplina: dados.disciplina,
      codigoDisciplina: dados.codigoDisciplina,
      descricao: dados.descricao,
      local: dados.local,
      vagas: dados.vagas,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim,
      monitorId: monitor.id,
      horarios: { create: dados.horarios },
      sessoes: { create: sessoes },
    },
    include: INCLUIR_OFERTA,
  });

  return { ...formatarOferta(oferta), totalSessoes: sessoes.length };
}

async function listarOfertas(filtros, agora = new Date()) {
  const ofertas = await prisma.oferta.findMany({
    where: filtros,
    include: INCLUIR_OFERTA,
    orderBy: [{ disciplina: 'asc' }, { id: 'asc' }],
  });
  return Promise.all(
    ofertas.map(async (oferta) => ({ ...formatarOferta(oferta), proximaSessao: await proximaSessao(oferta.id, agora) })),
  );
}

async function detalharOferta(id, agora = new Date()) {
  const oferta = await buscarOfertaOuFalhar(id);
  return { ...formatarOferta(oferta), proximaSessao: await proximaSessao(id, agora) };
}

async function listarSessoesDaOferta(id, { desde }, agora = new Date()) {
  await buscarOfertaOuFalhar(id);
  const sessoes = await prisma.sessao.findMany({
    where: { ofertaId: id, inicio: { gte: desde ? instante(desde) : agora } },
    orderBy: { inicio: 'asc' },
    include: CONTAR_AGENDADOS,
  });
  return sessoes.map(formatarSessao);
}

// Sessões ainda não iniciadas e não canceladas: as que alterações e encerramento afetam.
function sessoesFuturas(ofertaId, agora) {
  return { ofertaId, status: 'PREVISTA', inicio: { gt: agora } };
}

async function encerrarOferta(id, agora) {
  await prisma.$transaction(async (tx) => {
    const futuras = await tx.sessao.findMany({ where: sessoesFuturas(id, agora), select: { id: true } });
    const ids = futuras.map((s) => s.id);
    await tx.agendamento.updateMany({
      where: { sessaoId: { in: ids }, status: 'AGENDADO' },
      data: { status: 'CANCELADO' },
    });
    await tx.sessao.updateMany({ where: { id: { in: ids } }, data: { status: 'CANCELADA' } });
    await tx.oferta.update({ where: { id }, data: { status: 'ENCERRADA' } });
  });
}

async function alterarOferta(usuario, id, alteracoes, agora = new Date()) {
  const oferta = await buscarOfertaOuFalhar(id);
  garantirDono(oferta, usuario);
  if (oferta.status === 'ENCERRADA') {
    throw conflito('OFERTA_ENCERRADA', 'Oferta encerrada não pode ser alterada.');
  }

  if (alteracoes.status === 'ENCERRADA') {
    await encerrarOferta(id, agora);
    return detalharOferta(id, agora);
  }

  const { descricao, local, vagas } = alteracoes;
  await prisma.$transaction(async (tx) => {
    if (vagas !== undefined) {
      const futuras = await tx.sessao.findMany({ where: sessoesFuturas(id, agora), include: CONTAR_AGENDADOS });
      const maiorOcupacao = Math.max(0, ...futuras.map((s) => s._count.agendamentos));
      if (vagas < maiorOcupacao) {
        throw conflito(
          'VAGAS_INSUFICIENTES',
          `Há sessão futura com ${maiorOcupacao} agendamentos; as vagas não podem ser menores que isso.`,
        );
      }
      await tx.sessao.updateMany({ where: sessoesFuturas(id, agora), data: { vagas } });
    }
    await tx.oferta.update({ where: { id }, data: { descricao, local, vagas } });
  });

  return detalharOferta(id, agora);
}

async function buscarSessaoOuFalhar(id) {
  const sessao = await prisma.sessao.findUnique({
    where: { id },
    include: { ...CONTAR_AGENDADOS, oferta: { select: { id: true, monitorId: true, status: true } } },
  });
  if (!sessao) {
    throw naoEncontrado('SESSAO_NAO_ENCONTRADA', 'Sessão não encontrada.');
  }
  return sessao;
}

// Monitor dono vê os agendamentos completos; demais usuários, só os nomes dos agendados.
async function detalharSessao(usuario, id) {
  const sessao = await buscarSessaoOuFalhar(id);
  const ehDono = sessao.oferta.monitorId === usuario.id;

  const agendamentos = await prisma.agendamento.findMany({
    where: { sessaoId: id, ...(ehDono ? {} : { status: 'AGENDADO' }) },
    include: { aluno: { select: { id: true, nome: true, email: true } } },
    orderBy: { criadoEm: 'asc' },
  });

  if (ehDono) {
    return {
      ...formatarSessao(sessao),
      agendamentos: agendamentos.map((a) => ({ id: a.id, status: a.status, aluno: a.aluno })),
    };
  }
  return { ...formatarSessao(sessao), agendados: agendamentos.map((a) => a.aluno.nome) };
}

async function cancelarSessao(usuario, id, agora = new Date()) {
  const sessao = await buscarSessaoOuFalhar(id);
  garantirDono({ monitorId: sessao.oferta.monitorId }, usuario);
  if (sessao.status !== 'PREVISTA' || sessao.inicio <= agora) {
    throw conflito('SESSAO_NAO_CANCELAVEL', 'Só é possível cancelar sessões previstas que ainda não começaram.');
  }

  await prisma.$transaction([
    prisma.agendamento.updateMany({ where: { sessaoId: id, status: 'AGENDADO' }, data: { status: 'CANCELADO' } }),
    prisma.sessao.update({ where: { id }, data: { status: 'CANCELADA' } }),
  ]);
  return detalharSessao(usuario, id);
}

module.exports = {
  formatarSessao,
  CONTAR_AGENDADOS,
  criarOferta,
  listarOfertas,
  detalharOferta,
  listarSessoesDaOferta,
  alterarOferta,
  detalharSessao,
  cancelarSessao,
};
