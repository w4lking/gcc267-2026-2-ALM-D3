# AGENTS.md

Instruções para agentes de IA (Claude Code, Codex, Copilot, Cursor etc.) e para
integrantes da equipe que trabalham neste repositório.

## Projeto

Sistema de **Monitoria e Atendimento ao Aluno** da UFLA (disciplina GCC267, domínio D3).
Transação principal: o aluno vê uma **oferta** de monitoria, faz um **agendamento**
e, após a sessão, tem a **frequência** registrada.

Contextos de domínio (manter separados no código):

| Contexto | Responsabilidade |
|---|---|
| Oferta | Cadastro e listagem de monitorias disponíveis |
| Agendamento | Reserva de horários entre aluno e monitor |
| Frequência | Registro e consulta de presença nas sessões |

Mais contexto: [docs/visao-produto.md](docs/visao-produto.md).

## Estrutura

```
frontend/   React 19 + TypeScript + Vite (ESLint)
backend/    Node.js + Express 5 (CommonJS), entrada em src/index.js
docs/       visão do produto, equipe, padrões e ADRs (docs/adr/)
.github/    CI (GitHub Actions) e template de PR
```

## Comandos

Requer Node.js 22.

```bash
npm run install:all            # instala frontend e backend (na raiz)
npm run lint                   # lint do frontend
npm run build                  # build do frontend + checagem do backend

cd frontend && npm run dev     # http://localhost:5173
cd backend  && npm run dev     # http://localhost:3000  (GET /health)
```

Variáveis de ambiente do backend: copie `backend/.env.example` para `backend/.env`.

## Convenções de código

- **Idioma:** domínio e documentação em português (`oferta`, `agendamento`, `frequencia`);
  sem acentos em nomes de arquivos, variáveis e rotas.
- **Frontend:** TypeScript estrito; componentes funcionais com hooks; um componente por
  arquivo em `PascalCase.tsx`; organize por contexto (`src/oferta/`, `src/agendamento/`, ...).
- **Backend:** rotas REST no plural e em minúsculas (`/ofertas`, `/agendamentos`,
  `/frequencias`); organize por contexto (`src/oferta/`, ...); configurações via `.env`,
  nunca no código.
- Siga o estilo do código ao redor; não adicione dependências sem necessidade clara.
- Decisões de arquitetura relevantes viram um ADR em `docs/adr/` (numeração sequencial,
  mesmo formato do [ADR-0000](docs/adr/0000-registro-de-decisoes.md)).

## Git — regras obrigatórias

Detalhes em [docs/padroes-de-commit.md](docs/padroes-de-commit.md).

- **Nunca** faça commit ou push direto em `main` ou `develop` (são protegidas).
- Crie branches a partir de `develop`: `feature/<contexto>-<descricao>`, `fix/...`, `docs/...`.
- Commits em **Conventional Commits**, em português:
  `feat(oferta): adiciona filtro por disciplina`.
- **Não** adicione linhas de coautoria ou assinatura de IA
  (`Co-Authored-By: ...`, "Generated with ...") em commits ou PRs.
- Antes de commitar: `npm run lint` e `npm run build` precisam passar.
- Nunca commite `node_modules/`, `dist/` ou `.env`.
- PR para `develop` exige CI verde (`frontend`, `backend`) e 1 aprovação.

## Para agentes de IA

- Leia este arquivo e os documentos em `docs/` antes de propor mudanças.
- Faça mudanças pequenas e focadas no que foi pedido; não reformate arquivos inteiros.
- Não crie commits, branches ou PRs sem o pedido explícito de quem está usando o agente.
- Ao terminar, rode lint e build e informe o resultado com honestidade.
