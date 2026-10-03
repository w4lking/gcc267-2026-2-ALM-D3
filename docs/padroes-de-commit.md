# Padrões de Commit, Branches e Pull Requests

Guia da equipe para manter o histórico legível e as entregas rastreáveis.
O fluxo de branches está justificado no [ADR-0001](adr/0001-fluxo-de-branches.md).

## Commits — Conventional Commits

### Formato

```
<tipo>(<escopo opcional>): <descrição>

<corpo opcional: o que mudou e por quê>

<rodapé opcional: Closes #12>
```

### Tipos

| Tipo | Quando usar | Exemplo |
|---|---|---|
| `feat` | Nova funcionalidade | `feat(oferta): lista monitorias disponíveis` |
| `fix` | Correção de bug | `fix(agendamento): impede reserva em horário ocupado` |
| `docs` | Somente documentação | `docs: adiciona ADR de banco de dados` |
| `style` | Formatação, sem mudar lógica | `style(frontend): aplica indentação padrão` |
| `refactor` | Reestruturação sem mudar comportamento | `refactor(backend): extrai rotas de oferta` |
| `test` | Adiciona ou ajusta testes | `test(frequencia): cobre registro de presença` |
| `chore` | Configuração, dependências, tarefas de manutenção | `chore: atualiza vite para 8.3` |
| `ci` | Pipeline do GitHub Actions | `ci: adiciona job de testes do backend` |

### Escopos

Use o contexto de domínio ou a camada afetada:
`oferta`, `agendamento`, `frequencia`, `frontend`, `backend`.

### Regras

- Descrição em **português**, no **imperativo/presente**, **minúscula** e **sem ponto final**:
  - ✅ `feat(oferta): adiciona filtro por disciplina`
  - ❌ `Adicionado filtro.` · ❌ `update` · ❌ `ajustes`
- Até ~72 caracteres na primeira linha.
- Um commit = uma mudança lógica. Não misture refatoração com feature.
- Mudança que quebra compatibilidade (ex.: muda formato da API): use `!` → `feat(backend)!: altera payload de agendamento` e explique no corpo.
- Referencie a issue no rodapé quando houver: `Closes #12`.
- Nunca commite `node_modules/`, `dist/` ou `.env` (já estão no `.gitignore`).
- Não adicione linhas de coautoria de ferramentas de IA (`Co-Authored-By: ...`). O autor é quem fez o commit.

## Branches

```
main  ←  desafio-XX  ←  develop  ←  feature/*, fix/*, docs/*
```

| Branch | Origem | Destino do PR | Exemplo |
|---|---|---|---|
| `feature/<contexto>-<descricao>` | `develop` | `develop` | `feature/oferta-listagem` |
| `fix/<contexto>-<descricao>` | `develop` | `develop` | `fix/agendamento-conflito-horario` |
| `docs/<descricao>` | `develop` | `develop` | `docs/padroes-contribuicao` |
| `desafio-XX` | `develop` | `main` | `desafio-02` |

- Nomes em minúsculas, palavras separadas por hífen, sem acentos.
- `main` e `develop` são protegidas: não é possível dar push direto.

### Dia a dia

```bash
git checkout develop
git pull
git checkout -b feature/oferta-listagem

# ... trabalho e commits ...

git fetch origin
git merge origin/develop        # mantém a branch atualizada
git push -u origin feature/oferta-listagem
# abra o PR para develop no GitHub
```

## Pull Requests

- Título no mesmo padrão do commit: `feat(oferta): lista monitorias disponíveis`.
- Descrição com **o que mudou**, **por quê** e **como testar** (o template é preenchido automaticamente).
- Requisitos para merge: **CI verde** (`frontend` e `backend`) e **1 aprovação** de outro integrante.
- PRs pequenos e focados — fica mais fácil de revisar.
- Quem abriu o PR faz o merge após a aprovação e apaga a branch.

### Revisão

Ao revisar, verifique:

- O código roda localmente (`npm run dev`) e o comportamento descrito acontece.
- Lint e build passam.
- Nomes claros, sem código comentado ou `console.log` esquecido.
- Mudanças de arquitetura vieram acompanhadas de um ADR em `docs/adr/`.
