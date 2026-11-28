// Identificação simplificada pelo cabeçalho X-Usuario-Id (ADR-0003).
// Trocar por autenticação real deve alterar apenas este arquivo.

const prisma = require('./prisma');
const { naoAutenticado, proibido } = require('./erros');

// Global: anexa o usuário em req.usuario (ou null, se o cabeçalho não veio).
// Cabeçalho presente com id inválido ou inexistente responde 401 em qualquer rota.
async function identificarUsuario(req, res, next) {
  const cabecalho = req.get('X-Usuario-Id');
  req.usuario = null;

  if (cabecalho === undefined) {
    return next();
  }

  const id = Number(cabecalho);
  const usuario = Number.isInteger(id) && id > 0
    ? await prisma.usuario.findUnique({ where: { id } })
    : null;

  if (!usuario) {
    throw naoAutenticado('USUARIO_INVALIDO', 'O usuário informado em X-Usuario-Id não existe.');
  }

  req.usuario = usuario;
  next();
}

// Por rota: exige que a requisição tenha um usuário identificado.
function exigirUsuario(req, res, next) {
  if (!req.usuario) {
    throw naoAutenticado('IDENTIFICACAO_OBRIGATORIA', 'Informe o cabeçalho X-Usuario-Id.');
  }
  next();
}

// Por rota: exige usuário identificado com um dos papéis informados.
function exigirPapel(...papeis) {
  return (req, res, next) => {
    exigirUsuario(req, res, () => {
      if (!papeis.includes(req.usuario.papel)) {
        throw proibido('PAPEL_NAO_PERMITIDO', `Operação permitida apenas para: ${papeis.join(', ')}.`);
      }
      next();
    });
  };
}

module.exports = { identificarUsuario, exigirUsuario, exigirPapel };
