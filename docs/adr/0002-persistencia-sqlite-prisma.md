# ADR-0002 — Persistência com SQLite e Prisma

## Status

Aceito

## Contexto

O backend precisa guardar ofertas, agendamentos, frequências e usuários.
A equipe tem três integrantes, cada um rodando o projeto na própria máquina,
e o foco da disciplina é o processo de desenvolvimento, não a infraestrutura.
Precisamos de uma solução que:

- funcione sem instalar nem configurar um servidor de banco de dados;
- tenha o esquema versionado no repositório, para que todos tenham o mesmo banco;
- permita trocar de banco no futuro sem reescrever as consultas.

Alternativas consideradas:

| Opção | Prós | Contras |
|---|---|---|
| Arquivo JSON / memória | Zero configuração | Sem consultas, sem integridade, perde dados |
| PostgreSQL + Docker | Banco de produção real | Exige Docker em todas as máquinas e no CI |
| **SQLite + Prisma** | Arquivo local, sem servidor; migrations versionadas; troca de banco mudando o `provider` | SQLite não é indicado para alta concorrência |

## Decisão

Usar **SQLite** como banco e **Prisma** como ORM no backend.

- O esquema fica em `backend/prisma/schema.prisma`.
- Toda alteração no esquema gera uma migration (`npx prisma migrate dev --name <descricao>`),
  commitada junto com o código que depende dela.
- O arquivo do banco (`*.db`) não é versionado; cada integrante gera o seu com as migrations.
- A URL do banco vem do `.env` (`DATABASE_URL="file:./dev.db"`).
- Um script de seed (`backend/prisma/seed.js`) popula dados de exemplo para desenvolvimento.

## Consequências

- Qualquer integrante sobe o backend com `npm ci` + `npx prisma migrate dev`, sem instalar banco.
- Migrations no repositório tornam as mudanças de esquema revisáveis no PR.
- Se o projeto precisar de um banco de produção, a troca para PostgreSQL exige mudar o
  `provider` e gerar novas migrations, sem reescrever as consultas.
- Dois PRs que alteram o esquema ao mesmo tempo podem conflitar nas migrations; quem fizer
  o merge por último deve regenerar a sua migration a partir da `develop` atualizada.
