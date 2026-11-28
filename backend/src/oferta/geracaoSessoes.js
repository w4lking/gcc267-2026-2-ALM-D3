// Gera as sessões concretas de uma oferta recorrente (ADR-0004).

const { instante, somarDias, diaSemana } = require('../comum/datas');

// Uma sessão para cada horário semanal em cada dia de dataInicio a dataFim (inclusive).
// Com `aPartirDe`, descarta as sessões que começam antes desse instante.
function gerarSessoes({ horarios, dataInicio, dataFim, vagas, aPartirDe = null }) {
  const sessoes = [];
  for (let dia = dataInicio; dia <= dataFim; dia = somarDias(dia, 1)) {
    for (const horario of horarios) {
      if (horario.diaSemana !== diaSemana(dia)) continue;

      const inicio = instante(dia, horario.horaInicio);
      if (aPartirDe && inicio < aPartirDe) continue;

      sessoes.push({ inicio, fim: instante(dia, horario.horaFim), vagas });
    }
  }
  return sessoes.sort((a, b) => a.inicio - b.inicio);
}

module.exports = { gerarSessoes };
