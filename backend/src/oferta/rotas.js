const { Router } = require('express');

const { exigirUsuario, exigirPapel } = require('../comum/identificacao');
const { inteiroPositivo, inteiroPositivoOpcional, texto, opcao, invalido } = require('../comum/validacao');
const { dataValida, horaValida, hoje, somarMeses } = require('../comum/datas');
const servico = require('./servico');

const DIAS_SEMANA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const CAMPOS_EDITAVEIS = ['descricao', 'local', 'vagas', 'status'];

const rotas = Router();

function data(valor, campo) {
  if (!dataValida(valor)) throw invalido(`"${campo}" deve ser uma data no formato AAAA-MM-DD.`);
  return valor;
}

function validarHorarios(horarios) {
  if (!Array.isArray(horarios) || horarios.length === 0) {
    throw invalido('"horarios" deve ter ao menos um horário.');
  }

  const validados = horarios.map((horario, i) => {
    const { diaSemana, horaInicio, horaFim } = horario ?? {};
    opcao(diaSemana, `horarios[${i}].diaSemana`, DIAS_SEMANA);
    if (!horaValida(horaInicio) || !horaValida(horaFim)) {
      throw invalido(`"horarios[${i}]" deve ter horaInicio e horaFim no formato HH:mm.`);
    }
    if (horaFim <= horaInicio) {
      throw invalido(`"horarios[${i}].horaFim" deve ser depois de horaInicio.`);
    }
    return { diaSemana, horaInicio, horaFim };
  });

  for (const [i, a] of validados.entries()) {
    for (const b of validados.slice(i + 1)) {
      if (a.diaSemana === b.diaSemana && a.horaInicio < b.horaFim && b.horaInicio < a.horaFim) {
        throw invalido(`Horários sobrepostos em ${a.diaSemana}.`);
      }
    }
  }
  return validados;
}

function validarNovaOferta(corpo) {
  const dataInicio = data(corpo.dataInicio, 'dataInicio');
  const dataFim = data(corpo.dataFim, 'dataFim');
  if (dataInicio < hoje()) throw invalido('"dataInicio" não pode estar no passado.');
  if (dataFim < dataInicio) throw invalido('"dataFim" deve ser igual ou posterior a dataInicio.');
  if (dataFim > somarMeses(dataInicio, 6)) throw invalido('O período da oferta é de no máximo 6 meses.');

  return {
    disciplina: texto(corpo.disciplina, 'disciplina'),
    codigoDisciplina: texto(corpo.codigoDisciplina, 'codigoDisciplina', { maximo: 20 }).toUpperCase(),
    descricao: texto(corpo.descricao, 'descricao', { obrigatorio: false, maximo: 1000 }),
    local: texto(corpo.local, 'local'),
    vagas: inteiroPositivo(corpo.vagas, 'vagas'),
    dataInicio,
    dataFim,
    horarios: validarHorarios(corpo.horarios),
  };
}

function validarAlteracoes(corpo) {
  const naoEditaveis = Object.keys(corpo).filter((campo) => !CAMPOS_EDITAVEIS.includes(campo));
  if (naoEditaveis.length > 0) {
    throw invalido(
      `Campos não editáveis: ${naoEditaveis.join(', ')}. Para mudar horários ou período, encerre e crie outra oferta.`,
    );
  }

  if (corpo.status !== undefined) {
    opcao(corpo.status, 'status', ['ENCERRADA']);
    if (Object.keys(corpo).length > 1) throw invalido('Para encerrar, envie apenas { "status": "ENCERRADA" }.');
    return { status: 'ENCERRADA' };
  }

  if (Object.keys(corpo).length === 0) throw invalido('Informe ao menos um campo para alterar.');
  return {
    descricao: 'descricao' in corpo ? texto(corpo.descricao, 'descricao', { obrigatorio: false, maximo: 1000 }) : undefined,
    local: 'local' in corpo ? texto(corpo.local, 'local') : undefined,
    vagas: inteiroPositivoOpcional(corpo.vagas, 'vagas'),
  };
}

rotas.get('/ofertas', async (req, res) => {
  const filtros = {
    status: opcao(req.query.status, 'status', ['ABERTA', 'ENCERRADA'], { obrigatorio: false }),
    codigoDisciplina: req.query.codigoDisciplina
      ? texto(req.query.codigoDisciplina, 'codigoDisciplina').toUpperCase()
      : undefined,
    monitorId: inteiroPositivoOpcional(req.query.monitorId, 'monitorId'),
  };
  res.json(await servico.listarOfertas(filtros));
});

rotas.get('/ofertas/:id', async (req, res) => {
  res.json(await servico.detalharOferta(inteiroPositivo(req.params.id, 'id')));
});

rotas.get('/ofertas/:id/sessoes', async (req, res) => {
  const desde = req.query.desde === undefined ? undefined : data(req.query.desde, 'desde');
  res.json(await servico.listarSessoesDaOferta(inteiroPositivo(req.params.id, 'id'), { desde }));
});

rotas.post('/ofertas', exigirPapel('MONITOR'), async (req, res) => {
  const oferta = await servico.criarOferta(req.usuario, validarNovaOferta(req.body ?? {}));
  res.status(201).json(oferta);
});

rotas.patch('/ofertas/:id', exigirPapel('MONITOR'), async (req, res) => {
  const id = inteiroPositivo(req.params.id, 'id');
  res.json(await servico.alterarOferta(req.usuario, id, validarAlteracoes(req.body ?? {})));
});

rotas.get('/sessoes/:id', exigirUsuario, async (req, res) => {
  res.json(await servico.detalharSessao(req.usuario, inteiroPositivo(req.params.id, 'id')));
});

rotas.patch('/sessoes/:id/cancelar', exigirPapel('MONITOR'), async (req, res) => {
  res.json(await servico.cancelarSessao(req.usuario, inteiroPositivo(req.params.id, 'id')));
});

module.exports = rotas;
