// Erros de negócio da API. O handler global os converte no formato do docs/api.md:
// { "erro": { "codigo": "...", "mensagem": "..." } }

class ErroApi extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.codigo = codigo;
  }
}

const requisicaoInvalida = (codigo, mensagem) => new ErroApi(400, codigo, mensagem);
const naoAutenticado = (codigo, mensagem) => new ErroApi(401, codigo, mensagem);
const proibido = (codigo, mensagem) => new ErroApi(403, codigo, mensagem);
const naoEncontrado = (codigo, mensagem) => new ErroApi(404, codigo, mensagem);
const conflito = (codigo, mensagem) => new ErroApi(409, codigo, mensagem);

module.exports = {
  ErroApi,
  requisicaoInvalida,
  naoAutenticado,
  proibido,
  naoEncontrado,
  conflito,
};
