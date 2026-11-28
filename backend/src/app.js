const express = require('express');
const cors = require('cors');

const { identificarUsuario } = require('./comum/identificacao');
const { rotaNaoEncontrada, tratarErros } = require('./comum/tratamentoErros');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(identificarUsuario);

// Rotas dos contextos (cada router declara os caminhos completos).
app.use(require('./usuario/rotas'));
app.use(require('./oferta/rotas'));
app.use(require('./agendamento/rotas'));
app.use(require('./frequencia/rotas'));

app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;
