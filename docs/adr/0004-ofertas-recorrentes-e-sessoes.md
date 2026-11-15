# ADR-0004 — Ofertas recorrentes e sessões

## Status

Aceito

## Contexto

Na UFLA, uma monitoria costuma acontecer em horários fixos durante o semestre
(ex.: toda terça e quinta, das 14h às 16h). Se cada sessão fosse uma oferta avulsa,
o monitor teria que cadastrar dezenas de ofertas iguais. Por outro lado, o aluno
agenda um **dia específico**, e a frequência é registrada por **dia**.

Precisamos separar "a monitoria" (recorrente) de "cada encontro" (concreto).

## Decisão

- **Oferta** é a monitoria recorrente: disciplina, monitor, local, vagas por sessão,
  período (`dataInicio` a `dataFim`) e um ou mais **horários semanais**
  (`diaSemana`, `horaInicio`, `horaFim`).
- **Sessão** é cada ocorrência concreta, com data e hora de início e fim.
  As sessões são **geradas na criação da oferta**, para todo o período, e gravadas no banco.
- O aluno agenda uma **sessão**; a frequência é registrada por agendamento de sessão.
- O período de uma oferta é de no máximo 6 meses (um semestre).
- Os horários são informados no fuso de **America/Sao_Paulo** e gravados em UTC.
- Não existe exclusão de oferta. O monitor **encerra** a oferta: as sessões futuras são
  canceladas e os agendamentos delas também. Sessões passadas e frequências são mantidas.
- O monitor pode **cancelar uma sessão específica** (ex.: feriado), cancelando os
  agendamentos dela.
- Alterar os horários semanais não é permitido: o monitor encerra a oferta e cria outra.

## Consequências

- Agendamento, cancelamento e frequência funcionam sobre registros concretos, sem
  calcular datas em tempo de consulta.
- Feriados e imprevistos se resolvem cancelando sessões individuais.
- O histórico de frequência se preserva, pois nada é apagado.
- Uma oferta de um semestre gera em torno de 20 a 40 sessões no banco, volume irrelevante.
- Não editar horários simplifica muito as regras, ao custo de o monitor recriar a
  oferta quando o horário mudar.
