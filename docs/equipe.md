# Equipe

| Integrante | Papel |
|---|---|
| Layon Walker | Front-end/Backend |
| Marcos Vinicius | Front-end/PO |
| Alexander Olegário | Designer/Backend |

## Organização

- `main`: apenas entregas aprovadas
- `develop`: integração contínua do trabalho da equipe
- `feature/<contexto>-<descricao>`, `fix/...`, `docs/...`: sempre criadas a partir de `develop`
  (ex.: `feature/oferta-listagem`, `feature/agendamento-reserva`)
- Entrega de desafio: cria-se `desafio-XX` a partir de `develop` e abre-se PR para `main`
- Todo merge (em `develop` ou `main`) via Pull Request com CI verde e revisão de ao menos um integrante
- Commits seguem Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`)
- Detalhes em [ADR-0001](adr/0001-fluxo-de-branches.md) e [padrões de commit](padroes-de-commit.md)
- Instruções para agentes de IA em [AGENTS.md](../AGENTS.md)
- Comunicação pelo WhatsApp/Discord da equipe