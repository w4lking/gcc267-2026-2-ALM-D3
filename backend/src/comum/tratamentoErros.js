// Respostas de erro no formato padrão do docs/api.md. Registrar por último no app.js.

const { ErroApi } = require('./erros');

function responderErro(res, status, codigo, mensagem) {
  res.status(status).json({ erro: { codigo, mensagem } });
}

function rotaNaoEncontrada(req, res) {
  responderErro(res, 404, 'ROTA_NAO_ENCONTRADA', `Rota ${req.method} ${req.path} não existe.`);
}

// O Express só reconhece o handler de erro pelos 4 parâmetros, mesmo sem usar o `next`.
function tratarErros(erro, req, res, next) {
  if (erro instanceof ErroApi) {
    return responderErro(res, erro.status, erro.codigo, erro.message);
  }

  // Corpo com JSON malformado (lançado pelo express.json()).
  if (erro.type === 'entity.parse.failed') {
    return responderErro(res, 400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.');
  }

  console.error(erro);
  responderErro(res, 500, 'ERRO_INTERNO', 'Erro interno do servidor.');
}

module.exports = { rotaNaoEncontrada, tratarErros };
