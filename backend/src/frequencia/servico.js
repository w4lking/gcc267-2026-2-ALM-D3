// Contexto Frequência: registro de presença pelos monitores (docs/api.md).

const prisma = require('../comum/prisma');
const { conflito, naoEncontrado, proibido, requisicaoInvalida } = require('../comum/erros');
const { RESUMO_OFERTA } = require('../agendamento/servico');

const RESUMO_SESSAO = { select: { id: true, inicio: true, fim: true, status: true } };

function formatarFrequencia(frequencia) {
  return {
    id: frequencia.id,
    agendamentoId: frequencia.agendamentoId,
    presente: frequencia.presente,
    observacao: frequencia.observacao,
    registradoEm: frequencia.registradoEm,
  };
}

// Registro e mudança do agendamento para REALIZADO na mesma transação.
async function registrar(monitor, { agendamentoId, presente, observacao }, agora = new Date()) {
  const frequencia = await prisma.$transaction(async (tx) => {
    const agendamento = await tx.agendamento.findUnique({
      where: { id: agendamentoId },
      include: { sessao: { include: { oferta: { select: { monitorId: true } } } }, frequencia: true },
    });
    if (!agendamento) {
      throw naoEncontrado('AGENDAMENTO_NAO_ENCONTRADO', 'Agendamento não encontrado.');
    }
    if (agendamento.sessao.oferta.monitorId !== monitor.id) {
      throw proibido('ACESSO_NEGADO', 'Apenas o monitor responsável pela oferta pode registrar a frequência.');
    }
    if (agendamento.sessao.inicio > agora) {
      throw conflito('SESSAO_NAO_INICIADA', 'A frequência só pode ser registrada depois do início da sessão.');
    }
    if (agendamento.frequencia) {
      throw conflito('FREQUENCIA_JA_REGISTRADA', 'A frequência deste agendamento já foi registrada.');
    }
    if (agendamento.status !== 'AGENDADO') {
      throw conflito('AGENDAMENTO_NAO_ATIVO', 'Só é possível registrar frequência de agendamentos ativos.');
    }

    await tx.agendamento.update({ where: { id: agendamentoId }, data: { status: 'REALIZADO' } });
    return tx.frequencia.create({ data: { agendamentoId, presente, observacao } });
  });
  return formatarFrequencia(frequencia);
}

async function listarDoAluno(aluno) {
  const frequencias = await prisma.frequencia.findMany({
    where: { agendamento: { alunoId: aluno.id } },
    include: { agendamento: { include: { sessao: { select: { ...RESUMO_SESSAO.select, oferta: RESUMO_OFERTA } } } } },
    orderBy: { agendamento: { sessao: { inicio: 'asc' } } },
  });
  return frequencias.map((f) => {
    const { oferta, ...sessao } = f.agendamento.sessao;
    return { ...formatarFrequencia(f), sessao, oferta };
  });
}

// Monitor consulta por sessão ou por oferta, sempre de uma oferta sua.
async function listarDoMonitor(monitor, { sessaoId, ofertaId }) {
  if (sessaoId === undefined && ofertaId === undefined) {
    throw requisicaoInvalida('DADOS_INVALIDOS', 'Monitores devem informar "sessaoId" ou "ofertaId".');
  }

  let donoId;
  if (sessaoId !== undefined) {
    const sessao = await prisma.sessao.findUnique({ where: { id: sessaoId }, include: { oferta: { select: { monitorId: true } } } });
    if (!sessao) throw naoEncontrado('SESSAO_NAO_ENCONTRADA', 'Sessão não encontrada.');
    donoId = sessao.oferta.monitorId;
  } else {
    const oferta = await prisma.oferta.findUnique({ where: { id: ofertaId } });
    if (!oferta) throw naoEncontrado('OFERTA_NAO_ENCONTRADA', 'Oferta não encontrada.');
    donoId = oferta.monitorId;
  }
  if (donoId !== monitor.id) {
    throw proibido('ACESSO_NEGADO', 'Apenas o monitor responsável pela oferta pode ver as frequências.');
  }

  const filtroSessao = sessaoId !== undefined ? { id: sessaoId } : { ofertaId };
  const frequencias = await prisma.frequencia.findMany({
    where: { agendamento: { sessao: filtroSessao } },
    include: { agendamento: { include: { aluno: { select: { id: true, nome: true, email: true } }, sessao: RESUMO_SESSAO } } },
    orderBy: [{ agendamento: { sessao: { inicio: 'asc' } } }, { id: 'asc' }],
  });
  return frequencias.map((f) => ({ ...formatarFrequencia(f), aluno: f.agendamento.aluno, sessao: f.agendamento.sessao }));
}

module.exports = { registrar, listarDoAluno, listarDoMonitor };
