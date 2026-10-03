# ADR-0001 — Fluxo de Branches

## Status

Aceito

## Contexto

A equipe tem três integrantes trabalhando em paralelo nos contextos Oferta,
Agendamento e Frequência. Desenvolver diretamente em branches `desafio-XX`
mistura trabalho em andamento com o que será entregue e aumenta conflitos.

## Decisão

Adotamos um fluxo simplificado inspirado no Git Flow:

```
main  ←  desafio-XX  ←  develop  ←  feature/*, fix/*, docs/*
```

- `main` recebe somente entregas, via PR de `desafio-XX`.
- `develop` é a branch de integração; recebe PRs das branches de trabalho.
- Branches de trabalho saem de `develop` e seguem o padrão
  `feature/<contexto>-<descricao>`.
- `main` e `develop` são protegidas: PR obrigatório, CI verde e 1 aprovação.

## Consequências

- Cada integrante trabalha isolado, preferencialmente em um contexto distinto
- O histórico de `main` reflete apenas as entregas dos desafios
- Exige manter as branches de trabalho atualizadas com `develop` (rebase/merge frequente)
