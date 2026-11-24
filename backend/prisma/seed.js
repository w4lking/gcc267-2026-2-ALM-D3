// Dados de exemplo para desenvolvimento.
// ATENÇÃO: apaga todos os dados do banco antes de inserir.
// As datas são relativas ao dia de hoje, para sempre haver sessões passadas e futuras.

const prisma = require('../src/comum/prisma');

const FUSO_BRASILIA = '-03:00'; // America/Sao_Paulo, sem horário de verão desde 2019
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

function dataISO(data) {
  return data.toISOString().slice(0, 10);
}

function somarDias(data, dias) {
  const resultado = new Date(data);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

// Datas e horários das sessões de uma oferta, para os dias entre `de` e `ate`.
function calcularSessoes(horarios, de, ate, vagas) {
  const sessoes = [];
  for (let dia = new Date(de); dia <= ate; dia = somarDias(dia, 1)) {
    const diaSemana = DIAS_SEMANA[dia.getUTCDay()];
    for (const horario of horarios.filter((h) => h.diaSemana === diaSemana)) {
      sessoes.push({
        inicio: new Date(`${dataISO(dia)}T${horario.horaInicio}:00${FUSO_BRASILIA}`),
        fim: new Date(`${dataISO(dia)}T${horario.horaFim}:00${FUSO_BRASILIA}`),
        vagas,
      });
    }
  }
  return sessoes;
}

async function limparBanco() {
  await prisma.frequencia.deleteMany();
  await prisma.agendamento.deleteMany();
  await prisma.sessao.deleteMany();
  await prisma.horario.deleteMany();
  await prisma.oferta.deleteMany();
  await prisma.usuario.deleteMany();
}

async function criarOferta(monitor, dados, horarios, de, ate) {
  return prisma.oferta.create({
    data: {
      ...dados,
      dataInicio: dataISO(de),
      dataFim: dataISO(ate),
      monitorId: monitor.id,
      horarios: { create: horarios },
      sessoes: { create: calcularSessoes(horarios, de, ate, dados.vagas) },
    },
    include: { sessoes: { orderBy: { inicio: 'asc' } } },
  });
}

async function main() {
  await limparBanco();

  const [carla, diego] = await Promise.all([
    prisma.usuario.create({ data: { nome: 'Carla Mendes', email: 'carla@estudante.ufla.br', papel: 'MONITOR' } }),
    prisma.usuario.create({ data: { nome: 'Diego Rocha', email: 'diego@estudante.ufla.br', papel: 'MONITOR' } }),
  ]);
  const [ana, bruno, julia] = await Promise.all([
    prisma.usuario.create({ data: { nome: 'Ana Souza', email: 'ana@estudante.ufla.br', papel: 'ALUNO' } }),
    prisma.usuario.create({ data: { nome: 'Bruno Lima', email: 'bruno@estudante.ufla.br', papel: 'ALUNO' } }),
    prisma.usuario.create({ data: { nome: 'Júlia Castro', email: 'julia@estudante.ufla.br', papel: 'ALUNO' } }),
  ]);

  const hoje = new Date(`${dataISO(new Date())}T00:00:00Z`);

  const aed = await criarOferta(
    carla,
    {
      disciplina: 'Algoritmos e Estruturas de Dados I',
      codigoDisciplina: 'GCC216',
      descricao: 'Monitoria semanal de AED I',
      local: 'DCC - Sala 105',
      vagas: 3,
    },
    [
      { diaSemana: 'TER', horaInicio: '14:00', horaFim: '16:00' },
      { diaSemana: 'QUI', horaInicio: '14:00', horaFim: '16:00' },
    ],
    somarDias(hoje, -14),
    somarDias(hoje, 42),
  );

  const calculo = await criarOferta(
    diego,
    {
      disciplina: 'Cálculo I',
      codigoDisciplina: 'GEX104',
      local: 'https://meet.google.com/exemplo-calculo',
      vagas: 5,
    },
    [{ diaSemana: 'QUA', horaInicio: '19:00', horaFim: '20:30' }],
    somarDias(hoje, -14),
    somarDias(hoje, 42),
  );

  const agora = new Date();
  const passadas = aed.sessoes.filter((s) => s.fim < agora);
  const [proximaAed] = aed.sessoes.filter((s) => s.inicio > agora);
  const [proximaCalculo] = calculo.sessoes.filter((s) => s.inicio > agora);

  // Sessão passada com frequência registrada (presença e falta).
  const ultimaPassada = passadas.at(-1);
  await prisma.agendamento.create({
    data: {
      sessaoId: ultimaPassada.id,
      alunoId: ana.id,
      status: 'REALIZADO',
      frequencia: { create: { presente: true, observacao: 'Tirou dúvidas sobre árvores AVL' } },
    },
  });
  await prisma.agendamento.create({
    data: {
      sessaoId: ultimaPassada.id,
      alunoId: bruno.id,
      status: 'REALIZADO',
      frequencia: { create: { presente: false } },
    },
  });

  // Sessão passada aguardando registro de frequência pelo monitor.
  await prisma.agendamento.create({
    data: { sessaoId: passadas.at(-2).id, alunoId: julia.id },
  });

  // Próxima sessão de AED com 2 das 3 vagas ocupadas e um cancelamento.
  await prisma.agendamento.createMany({
    data: [
      { sessaoId: proximaAed.id, alunoId: ana.id },
      { sessaoId: proximaAed.id, alunoId: julia.id },
      { sessaoId: proximaAed.id, alunoId: bruno.id, status: 'CANCELADO' },
    ],
  });
  await prisma.agendamento.create({
    data: { sessaoId: proximaCalculo.id, alunoId: bruno.id },
  });

  // Uma sessão futura cancelada pelo monitor (ex.: feriado).
  await prisma.sessao.update({
    where: { id: aed.sessoes.at(-1).id },
    data: { status: 'CANCELADA' },
  });

  console.log(
    `Seed concluído: ${await prisma.usuario.count()} usuários, ${await prisma.oferta.count()} ofertas, ` +
      `${await prisma.sessao.count()} sessões, ${await prisma.agendamento.count()} agendamentos.`,
  );
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
