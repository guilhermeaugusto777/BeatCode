# BC-001 — Padronizar agentes, notas e commits

- **Estado:** `DONE`
- **Agente responsável:** 1 — Tech Lead / Maestro
- **Colaboradores:** 2 — Requisitos/Arquitetura; 7 — QA; 8 — Segurança/DevOps
- **Dependências:** nenhuma

## Resultado esperado

O repositório tem um contrato explícito para os oito agentes Maestri, um roadmap legível, notas por tarefa e regra de um commit por feature implementada.

## Escopo

- [x] Adicionar `AGENTS.md` à raiz (restaurando o `openspec/AGENTS.md` original ao seu propósito OpenSpec).
- [x] Adicionar `notes/ROADMAP.md` e `notes/WORKLOG.md`.
- [x] Criar notas individuais em `notes/tasks/` para as próximas entregas (`001` a `005`).
- [x] Adicionar proposta e tasks OpenSpec para a capacidade de grafo 3D em `openspec/changes/interactive-3d-graph/`.
- [x] Adicionar/confirmar regras de `.gitignore` para ambientes, caches, builds, `.maestri/` e segredos.
- [x] Revisar o diff, integrar no checkout local e registrar commit coeso.

## Critérios de aceite

- [x] Os oito papéis e suas conexões constam em `AGENTS.md`.
- [x] O ciclo obrigatório por feature define nota, testes, revisão e commit.
- [x] O roadmap aponta para notas de tarefas existentes.
- [x] Nenhuma credencial real aparece nos arquivos adicionados.
- [x] O estado só muda para `DONE` após confirmar os arquivos no checkout e o commit real.

## Log de implementação

- 2026-10-24: Criada branch `chore/agent-workflow-3d-roadmap` a partir de `main`.
- Posicionado `AGENTS.md` na raiz do repositório e preservado `openspec/AGENTS.md` com as convenções OpenSpec.
- Movidos `proposal.md` e `tasks.md` para `openspec/changes/interactive-3d-graph/` junto com o delta spec `specs/interactive-force-graph-ui/spec.md`.
- Criada a nota `notes/tasks/003-interactive-3d-graph.md` e adicionado `.gitignore` cobrindo `.env`, `.spotify_token_cache`, `__pycache__/`, `.venv/`, `node_modules/`, `.next/` e `.maestri/`.
- Removido do índice Git o bytecode `backend/__pycache__/main.cpython-313.pyc` para manter o repositório limpo.
