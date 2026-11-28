# ADR-0003 — Identificação simplificada de usuários

## Status

Aceito

## Contexto

O sistema tem dois papéis com permissões diferentes: **aluno** (agenda sessões) e
**monitor** (cria ofertas e registra frequência). Uma autenticação real (senha, JWT,
login institucional da UFLA) tomaria tempo que, no MVP, é melhor gasto na transação
Oferta → Agendamento → Frequência.

Ainda assim, a API precisa saber **quem** está fazendo cada operação para aplicar as
regras de negócio (ex.: só o monitor da oferta registra frequência).

## Decisão

No MVP, não há login nem senha:

- Usuários são cadastrados com `nome`, `email` e `papel` (`ALUNO` ou `MONITOR`).
- O frontend tem uma tela simples de "entrar como", que escolhe um usuário existente
  e guarda o `id` dele no navegador.
- Toda requisição que depende do usuário envia o cabeçalho **`X-Usuario-Id`**.
- O backend carrega o usuário desse cabeçalho num middleware e valida o papel em cada rota.
  Sem o cabeçalho, ou com um id inexistente, responde `401`.

## Consequências

- A equipe implementa e testa as regras por papel desde o início, sem depender de autenticação.
- **Não é seguro**: qualquer pessoa pode se passar por outra enviando outro id.
  Aceitável apenas em ambiente de desenvolvimento e demonstração.
- Como a identificação fica isolada num middleware, trocar por autenticação real
  (ex.: JWT) depois muda só esse ponto e a tela de entrada, sem alterar as rotas.
  Essa troca deve ser registrada num novo ADR.
