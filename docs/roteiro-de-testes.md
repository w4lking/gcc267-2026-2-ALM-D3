# Roteiro de Teste Manual

Validação do produto antes da entrega: percorre a transação **Oferta → Agendamento →
Frequência** pela interface, nos papéis de aluno e de monitor, incluindo os principais
casos de erro. Regras completas em [api.md](api.md).

Marque cada passo em **OK?** e anote o que falhar (passo, o que aconteceu, print).
Um teste completo leva cerca de 20 minutos.

## Preparação

```bash
git checkout develop && git pull

cd backend
cp .env.example .env      # só na primeira vez
npm ci
npm run db:migrate
npm run db:seed           # recria os dados de exemplo (rode de novo para recomeçar o teste)
npm run dev               # http://localhost:3000

# em outro terminal
cd frontend
npm ci
npm run dev               # http://localhost:5173
```

### Dados do seed

As datas são relativas ao dia em que o seed rodou: sempre há sessões passadas e futuras.

| Usuário | Papel |
|---|---|
| Carla Mendes | Monitora de **GCC216** — AED I (ter e qui, 14h–16h, 3 vagas, DCC - Sala 105) |
| Diego Rocha | Monitor de **GEX104** — Cálculo I (qua, 19h–20h30, 5 vagas, online) |
| Ana Souza, Bruno Lima, Júlia Castro | Alunos |

Situação inicial:

- **Próxima sessão de GCC216:** Ana e Júlia agendadas (1 vaga livre); Bruno agendou e cancelou.
- **Próxima sessão de GEX104:** Bruno agendado.
- **Sessões passadas de GCC216:** uma com frequência já registrada (Ana presente, Bruno falta)
  e outra com a Júlia **aguardando registro** de frequência.
- **Última sessão de GCC216** do período: cancelada pela monitora.

## 1. Identificação

| # | Passo | Resultado esperado | OK? |
|---|---|---|---|
| 1.1 | Abrir o frontend | Tela "entrar como" lista os 5 usuários, separados por papel | |
| 1.2 | Entrar como **Ana** | Nome e papel aparecem no layout; menu de aluno | |
| 1.3 | Trocar para **Carla** | Menu muda para o de monitor | |
| 1.4 | Recarregar a página | Continua como Carla | |

## 2. Aluno: ofertas e agendamento

Entrar como **Bruno**.

| # | Passo | Resultado esperado | OK? |
|---|---|---|---|
| 2.1 | Abrir a lista de ofertas | GCC216 e GEX104 aparecem, com a próxima sessão de cada | |
| 2.2 | Filtrar por disciplina `GCC216` | Só AED I | |
| 2.3 | Abrir o detalhe de GCC216 | Horários ter e qui 14h–16h; próximas sessões com vagas | |
| 2.4 | Ver a próxima sessão | **1 vaga** disponível; agendados: Ana e Júlia (só nomes, sem e-mail; Bruno não aparece) | |
| 2.5 | Agendar a próxima sessão | Sucesso; a sessão passa a ter **0 vagas** | |
| 2.6 | Tentar agendar a mesma sessão de novo | Mensagem de que já está agendado (`AGENDAMENTO_DUPLICADO`) | |
| 2.7 | Abrir "meus agendamentos" | GCC216 e GEX104 agendados, com data, local e monitor; também aparecem o cancelamento anterior de GCC216 e a sessão passada (falta) | |
| 2.8 | Cancelar o agendamento de GCC216 | Status muda para cancelado; a sessão volta a ter 1 vaga | |

Entrar como **Ana**.

| # | Passo | Resultado esperado | OK? |
|---|---|---|---|
| 2.9 | Ver o histórico de frequência | Uma sessão de GCC216 com **presença** | |
| 2.10 | Em "meus agendamentos", ver a sessão passada | Aparece como realizada; não há opção de cancelar | |

## 3. Monitor: ofertas e frequência

Entrar como **Carla**.

| # | Passo | Resultado esperado | OK? |
|---|---|---|---|
| 3.1 | Criar oferta: "Estruturas de Dados", `GCC109`, 2 vagas, período de amanhã até amanhã + 28 dias, um horário no dia da semana de amanhã (se amanhã for domingo, comece na segunda) | Criada com **5 sessões** geradas | |
| 3.2 | Abrir "minhas ofertas" | GCC216 e GCC109 | |
| 3.3 | Ver a próxima sessão de GCC216 | Lista completa: agendamentos com status e e-mail dos alunos, inclusive o cancelado | |
| 3.4 | Na sessão passada em que a Júlia está agendada, registrar **presença** com uma observação | Sucesso; o agendamento vira realizado | |
| 3.5 | Tentar registrar de novo para a Júlia | Bloqueado (`FREQUENCIA_JA_REGISTRADA`) | |
| 3.6 | Tentar registrar frequência numa sessão futura | Bloqueado (`SESSAO_NAO_INICIADA`) | |
| 3.7 | Ver o resumo de frequência de GCC216 | Ana presente, Bruno falta, Júlia presente | |
| 3.8 | Editar GCC216: local para "DCC - Sala 200" | Alterado | |
| 3.9 | Editar GCC216: vagas para **1** | Bloqueado: a próxima sessão tem 2 agendados (`VAGAS_INSUFICIENTES`) | |
| 3.10 | Cancelar a **última** sessão de GCC109, confirmando na tela | Sessão aparece como cancelada; as demais continuam previstas | |

Entrar como **Júlia**.

| # | Passo | Resultado esperado | OK? |
|---|---|---|---|
| 3.11 | Ver o histórico de frequência | Sessão de GCC216 com presença e a observação da Carla | |

## 4. Permissões entre monitores

Entrar como **Diego**.

| # | Passo | Resultado esperado | OK? |
|---|---|---|---|
| 4.1 | Abrir a próxima sessão de GCC216 (da Carla) | Vê só os **nomes** dos agendados, sem e-mail nem status | |
| 4.2 | "Minhas ofertas" | Só GEX104; não há como editar ofertas da Carla | |

## 5. Encerramento (transação completa)

| # | Passo | Resultado esperado | OK? |
|---|---|---|---|
| 5.1 | Como **Ana**, agendar a primeira sessão de GCC109 | Sucesso | |
| 5.2 | Como **Carla**, encerrar GCC109, confirmando na tela | Oferta encerrada; sessões futuras canceladas | |
| 5.3 | Como **Ana**, abrir "meus agendamentos" | Agendamento de GCC109 aparece como **cancelado** | |
| 5.4 | Na lista de ofertas com filtro "abertas" | GCC109 não aparece | |
| 5.5 | Como **Carla**, tentar editar GCC109 | Bloqueado (`OFERTA_ENCERRADA`) | |

## 6. Robustez

| # | Passo | Resultado esperado | OK? |
|---|---|---|---|
| 6.1 | Com um usuário selecionado, rodar `npm run db:seed` e recarregar o frontend | O usuário salvo deixa de valer (`USUARIO_INVALIDO`) e o frontend volta para "entrar como" | |
| 6.2 | Parar o backend e navegar no frontend | Mensagem de erro amigável, sem tela em branco | |
| 6.3 | Abrir o frontend no celular, ou com a janela estreita | Telas utilizáveis | |

## Registro do teste

| Data | Quem testou | Commit (`git log -1 --oneline`) | Passos com falha |
|---|---|---|---|
| | | | |
