# OpenSpec Instructions & Conventions

Este diretório contém as especificações formais do projeto **Spotify Music Graph** seguindo o padrão **OpenSpec** (Spec-Driven Development) e a especificação **OpenAPI 3.1.0**.

## Estrutura de Diretórios
- `openspec/project.md`: Contexto global, arquitetura, formulação matemática e stack tecnológica.
- `openspec/openapi.yaml`: Contrato formal OpenAPI 3.1.0 da API REST (`/auth/*` e `/api/graph`).
- `openspec/specs/`: Especificações detalhadas por domínio de capacidade:
  - `spotify-auth-extraction/spec.md`: Fluxo OAuth 2.0 (loopback `127.0.0.1`) e coleta de dados do Spotify.
  - `graph-topology-engine/spec.md`: Motor matemático TF-IDF, poda $k$-NN + MST, Louvain e modo Bipartido.
  - `interactive-force-graph-ui/spec.md`: Renderização Canvas 2D, destaque de ego-network, filtros e painel analítico.
- `openspec/changes/`: Diretório para propostas de mudanças futuras (`proposal.md`, `tasks.md`, deltas de spec).

## Formato das Especificações
Cada arquivo `spec.md` utiliza requisitos normativos (`SHALL` / `MUST`) acompanhados de cenários verificáveis no formato `#### Scenario:` (`GIVEN` / `WHEN` / `THEN`).
