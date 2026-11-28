// Validação da entrada das rotas. Toda falha vira 400 DADOS_INVALIDOS com mensagem
// apontando o campo, no formato padrão do docs/api.md.

const { requisicaoInvalida } = require('./erros');

function invalido(mensagem) {
  return requisicaoInvalida('DADOS_INVALIDOS', mensagem);
}

// Aceita número ou texto numérico (params e query chegam como texto).
function inteiroPositivo(valor, campo) {
  const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (!Number.isInteger(numero) || numero < 1) {
    throw invalido(`"${campo}" deve ser um inteiro positivo.`);
  }
  return numero;
}

function inteiroPositivoOpcional(valor, campo) {
  return valor === undefined ? undefined : inteiroPositivo(valor, campo);
}

function texto(valor, campo, { obrigatorio = true, maximo = 200 } = {}) {
  if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
    if (obrigatorio) throw invalido(`"${campo}" é obrigatório.`);
    return null;
  }
  if (typeof valor !== 'string') {
    throw invalido(`"${campo}" deve ser um texto.`);
  }
  const limpo = valor.trim();
  if (limpo.length > maximo) {
    throw invalido(`"${campo}" deve ter no máximo ${maximo} caracteres.`);
  }
  return limpo;
}

function opcao(valor, campo, opcoes, { obrigatorio = true } = {}) {
  if (valor === undefined && !obrigatorio) return undefined;
  if (!opcoes.includes(valor)) {
    throw invalido(`"${campo}" deve ser um destes valores: ${opcoes.join(', ')}.`);
  }
  return valor;
}

function booleano(valor, campo) {
  if (typeof valor !== 'boolean') {
    throw invalido(`"${campo}" deve ser true ou false.`);
  }
  return valor;
}

module.exports = { invalido, inteiroPositivo, inteiroPositivoOpcional, texto, opcao, booleano };
