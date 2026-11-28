const { Router } = require('express');

const { exigirUsuario, exigirPapel } = require('../comum/identificacao');
const { inteiroPositivo, inteiroPositivoOpcional } = require('../comum/validacao');
const servico = require('./servico');

const rotas = Router();

rotas.post('/agendamentos', exigirPapel('ALUNO'), async (req, res) => {
  const sessaoId = inteiroPositivo((req.body ?? {}).sessaoId, 'sessaoId');
  res.status(201).json(await servico.agendar(req.usuario, sessaoId));
});

// Aluno: os seus agendamentos. Monitor: os de uma sessão sua (?sessaoId=).
rotas.get('/agendamentos', exigirUsuario, async (req, res) => {
  if (req.usuario.papel === 'ALUNO') {
    return res.json(await servico.listarDoAluno(req.usuario));
  }
  const sessaoId = inteiroPositivoOpcional(req.query.sessaoId, 'sessaoId');
  res.json(await servico.listarDaSessao(req.usuario, sessaoId));
});

rotas.patch('/agendamentos/:id/cancelar', exigirPapel('ALUNO'), async (req, res) => {
  res.json(await servico.cancelar(req.usuario, inteiroPositivo(req.params.id, 'id')));
});

module.exports = rotas;
