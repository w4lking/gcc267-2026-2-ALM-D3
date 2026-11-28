const { Router } = require('express');

const { inteiroPositivo, texto, opcao, invalido } = require('../comum/validacao');
const servico = require('./servico');

const PAPEIS = ['ALUNO', 'MONITOR'];
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rotas = Router();

rotas.post('/usuarios', async (req, res) => {
  const corpo = req.body ?? {};
  const email = texto(corpo.email, 'email').toLowerCase();
  if (!FORMATO_EMAIL.test(email)) {
    throw invalido('"email" não é um e-mail válido.');
  }

  const usuario = await servico.criarUsuario({
    nome: texto(corpo.nome, 'nome'),
    email,
    papel: opcao(corpo.papel, 'papel', PAPEIS),
  });
  res.status(201).json(usuario);
});

rotas.get('/usuarios', async (req, res) => {
  const papel = opcao(req.query.papel, 'papel', PAPEIS, { obrigatorio: false });
  res.json(await servico.listarUsuarios({ papel }));
});

rotas.get('/usuarios/:id', async (req, res) => {
  res.json(await servico.buscarUsuario(inteiroPositivo(req.params.id, 'id')));
});

module.exports = rotas;
