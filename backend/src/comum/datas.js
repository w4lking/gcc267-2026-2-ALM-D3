// Datas no fuso America/Sao_Paulo (ADR-0004). O Brasil não tem horário de verão desde 2019,
// então o deslocamento é fixo em -03:00.
// Datas sem hora circulam como texto AAAA-MM-DD; instantes, como Date (UTC).

const FUSO = '-03:00';
const DESLOCAMENTO_MS = 3 * 60 * 60 * 1000;
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function paraUtc(data) {
  return new Date(`${data}T00:00:00Z`);
}

function dataValida(texto) {
  return typeof texto === 'string'
    && FORMATO_DATA.test(texto)
    && !Number.isNaN(paraUtc(texto).getTime())
    && paraUtc(texto).toISOString().startsWith(texto);
}

function horaValida(texto) {
  return typeof texto === 'string' && FORMATO_HORA.test(texto);
}

// Data de hoje no fuso de Brasília.
function hoje(agora = new Date()) {
  return new Date(agora.getTime() - DESLOCAMENTO_MS).toISOString().slice(0, 10);
}

// Instante (UTC) de uma data e hora no fuso de Brasília.
function instante(data, hora = '00:00') {
  return new Date(`${data}T${hora}:00${FUSO}`);
}

function somarDias(data, dias) {
  const resultado = paraUtc(data);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

function somarMeses(data, meses) {
  const resultado = paraUtc(data);
  resultado.setUTCMonth(resultado.getUTCMonth() + meses);
  return resultado.toISOString().slice(0, 10);
}

function diaSemana(data) {
  return DIAS_SEMANA[paraUtc(data).getUTCDay()];
}

module.exports = { dataValida, horaValida, hoje, instante, somarDias, somarMeses, diaSemana };
