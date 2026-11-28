const prisma = require('../comum/prisma');
const { conflito, naoEncontrado } = require('../comum/erros');

function formatarUsuario(usuario) {
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel };
}

async function criarUsuario({ nome, email, papel }) {
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    throw conflito('EMAIL_JA_CADASTRADO', 'Já existe um usuário com este e-mail.');
  }
  return formatarUsuario(await prisma.usuario.create({ data: { nome, email, papel } }));
}

async function listarUsuarios({ papel }) {
  const usuarios = await prisma.usuario.findMany({ where: { papel }, orderBy: { nome: 'asc' } });
  return usuarios.map(formatarUsuario);
}

async function buscarUsuario(id) {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) {
    throw naoEncontrado('USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
  }
  return formatarUsuario(usuario);
}

module.exports = { criarUsuario, listarUsuarios, buscarUsuario, formatarUsuario };
