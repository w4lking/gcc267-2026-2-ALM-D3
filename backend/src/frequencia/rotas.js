const { Router } = require('express');

const { exigirUsuario, exigirPapel } = require('../comum/identificacao');
const { inteiroPositivo, inteiroPositivoOpcional, texto, booleano } = require('../comum/validacao');
const servico = require('./servico');

const rotas = Router();

rotas.post('/frequencias', exigirPapel('MONITOR'), async (req, res) => {
  const corpo = req.body ?? {};
  const frequencia = await servico.registrar(req.usuario, {
    agendamentoId: inteiroPositivo(corpo.agendamentoId, 'agendamentoId'),
    presente: booleano(corpo.presente, 'presente'),
    observacao: texto(corpo.observacao, 'observacao', { obrigatorio: false, maximo: 1000 }),
  });
  res.status(201).json(frequencia);
});

// Aluno: o seu histórico. Monitor: de uma sessão (?sessaoId=) ou oferta (?ofertaId=) sua.
rotas.get('/frequencias', exigirUsuario, async (req, res) => {
  if (req.usuario.papel === 'ALUNO') {
    return res.json(await servico.listarDoAluno(req.usuario));
  }
  res.json(await servico.listarDoMonitor(req.usuario, {
    sessaoId: inteiroPositivoOpcional(req.query.sessaoId, 'sessaoId'),
    ofertaId: inteiroPositivoOpcional(req.query.ofertaId, 'ofertaId'),
  }));
});

module.exports = rotas;
