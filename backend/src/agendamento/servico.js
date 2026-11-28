// Contexto Agendamento: reserva de sessões pelos alunos (docs/api.md).

const prisma = require('../comum/prisma');
const { conflito, naoEncontrado, proibido, requisicaoInvalida } = require('../comum/erros');
const { formatarSessao, CONTAR_AGENDADOS } = require('../oferta/servico');

const RESUMO_OFERTA = {
  select: {
    id: true,
    disciplina: true,
    codigoDisciplina: true,
    local: true,
    monitor: { select: { id: true, nome: true } },
  },
};

function formatarAgendamento(agendamento) {
  return {
    id: agendamento.id,
    sessaoId: agendamento.sessaoId,
    alunoId: agendamento.alunoId,
    status: agendamento.status,
    criadoEm: agendamento.criadoEm,
  };
}

function formatarFrequencia(frequencia) {
  return frequencia
    ? { presente: frequencia.presente, observacao: frequencia.observacao, registradoEm: frequencia.registradoEm }
    : null;
}

// Checagens e criação na mesma transação: duas reservas simultâneas não estouram as vagas.
async function agendar(aluno, sessaoId, agora = new Date()) {
  const agendamento = await prisma.$transaction(async (tx) => {
    const sessao = await tx.sessao.findUnique({
      where: { id: sessaoId },
      include: { oferta: { select: { status: true } } },
    });
    if (!sessao) {
      throw naoEncontrado('SESSAO_NAO_ENCONTRADA', 'Sessão não encontrada.');
    }
    if (sessao.status !== 'PREVISTA' || sessao.oferta.status !== 'ABERTA' || sessao.inicio <= agora) {
      throw conflito('SESSAO_INDISPONIVEL', 'A sessão foi cancelada, a oferta foi encerrada ou a sessão já começou.');
    }

    const ativos = await tx.agendamento.findMany({ where: { sessaoId, status: 'AGENDADO' }, select: { alunoId: true } });
    if (ativos.some((a) => a.alunoId === aluno.id)) {
      throw conflito('AGENDAMENTO_DUPLICADO', 'Você já está agendado nesta sessão.');
    }
    if (ativos.length >= sessao.vagas) {
      throw conflito('SESSAO_SEM_VAGAS', 'Não há vagas disponíveis nesta sessão.');
    }

    return tx.agendamento.create({ data: { sessaoId, alunoId: aluno.id } });
  });
  return formatarAgendamento(agendamento);
}

async function listarDoAluno(aluno) {
  const agendamentos = await prisma.agendamento.findMany({
    where: { alunoId: aluno.id },
    include: { sessao: { include: { ...CONTAR_AGENDADOS, oferta: RESUMO_OFERTA } }, frequencia: true },
    orderBy: { sessao: { inicio: 'asc' } },
  });
  return agendamentos.map((a) => ({
    ...formatarAgendamento(a),
    sessao: formatarSessao(a.sessao),
    oferta: a.sessao.oferta,
    frequencia: formatarFrequencia(a.frequencia),
  }));
}

async function listarDaSessao(monitor, sessaoId) {
  if (sessaoId === undefined) {
    throw requisicaoInvalida('DADOS_INVALIDOS', 'Monitores devem informar "sessaoId".');
  }
  const sessao = await prisma.sessao.findUnique({ where: { id: sessaoId }, include: { oferta: { select: { monitorId: true } } } });
  if (!sessao) {
    throw naoEncontrado('SESSAO_NAO_ENCONTRADA', 'Sessão não encontrada.');
  }
  if (sessao.oferta.monitorId !== monitor.id) {
    throw proibido('ACESSO_NEGADO', 'Apenas o monitor responsável pela oferta pode ver os agendamentos.');
  }

  const agendamentos = await prisma.agendamento.findMany({
    where: { sessaoId },
    include: { aluno: { select: { id: true, nome: true, email: true } }, frequencia: true },
    orderBy: { criadoEm: 'asc' },
  });
  return agendamentos.map((a) => ({
    ...formatarAgendamento(a),
    aluno: a.aluno,
    frequencia: formatarFrequencia(a.frequencia),
  }));
}

async function cancelar(aluno, id, agora = new Date()) {
  const agendamento = await prisma.agendamento.findUnique({ where: { id }, include: { sessao: true } });
  if (!agendamento) {
    throw naoEncontrado('AGENDAMENTO_NAO_ENCONTRADO', 'Agendamento não encontrado.');
  }
  if (agendamento.alunoId !== aluno.id) {
    throw proibido('ACESSO_NEGADO', 'Você só pode cancelar os seus agendamentos.');
  }
  if (agendamento.status !== 'AGENDADO' || agendamento.sessao.inicio <= agora) {
    throw conflito('AGENDAMENTO_NAO_CANCELAVEL', 'Só é possível cancelar agendamentos ativos antes do início da sessão.');
  }

  const cancelado = await prisma.agendamento.update({ where: { id }, data: { status: 'CANCELADO' } });
  return formatarAgendamento(cancelado);
}

module.exports = { agendar, listarDoAluno, listarDaSessao, cancelar, formatarFrequencia, RESUMO_OFERTA };
