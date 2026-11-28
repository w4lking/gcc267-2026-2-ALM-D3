// Cria dados de teste direto no banco, sem passar pelas regras da API.

const { prisma } = require('./banco');

const HORA_MS = 60 * 60 * 1000;
let contador = 0;

function criarUsuario(papel, nome = `${papel.toLowerCase()} ${++contador}`) {
  return prisma.usuario.create({
    data: { nome, email: `usuario${++contador}@teste.br`, papel },
  });
}

// Oferta com uma sessão de 2h para cada deslocamento (em horas) a partir de agora.
// Ex.: [-48, 24] cria uma sessão há dois dias e outra amanhã.
async function criarOfertaComSessoes(monitor, { horasAPartirDeAgora = [24, 72], vagas = 2, ...dados } = {}) {
  const agora = Date.now();
  return prisma.oferta.create({
    data: {
      disciplina: 'Algoritmos e Estruturas de Dados I',
      codigoDisciplina: 'GCC216',
      local: 'DCC - Sala 105',
      vagas,
      dataInicio: '2026-01-01',
      dataFim: '2026-06-30',
      monitorId: monitor.id,
      horarios: { create: [{ diaSemana: 'TER', horaInicio: '14:00', horaFim: '16:00' }] },
      sessoes: {
        create: horasAPartirDeAgora.map((horas) => ({
          inicio: new Date(agora + horas * HORA_MS),
          fim: new Date(agora + (horas + 2) * HORA_MS),
          vagas,
        })),
      },
      ...dados,
    },
    include: { sessoes: { orderBy: { inicio: 'asc' } } },
  });
}

function agendar(sessao, aluno, status = 'AGENDADO') {
  return prisma.agendamento.create({ data: { sessaoId: sessao.id, alunoId: aluno.id, status } });
}

module.exports = { criarUsuario, criarOfertaComSessoes, agendar };
