# BeatCode — Roadmap e quadro de tarefas

> Última revisão: 2026-10-24. Atualize o estado somente com evidências da execução real.

## Objetivo

Permitir que uma pessoa conecte o Spotify e explore suas afinidades musicais em grafos 3D interativos, ampliáveis e navegáveis, mantendo o motor de teoria dos grafos e o modo demo.

## Quadro

| ID | Tarefa | Estado | Agente principal | Nota |
|---|---|---|---|---|
| BC-001 | Instalar processo de agentes, notas de tarefas e commits por feature | `DONE` | 1 — Maestro | [BC-001](tasks/001-agent-workflow.md) |
| BC-002 | Auditar autenticação e endpoints Spotify diante das regras atuais | `DONE` | 4 — Back-end; 8 — Segurança | [BC-002](tasks/002-spotify-compatibility.md) |
| BC-003 | Implementar visualização 3D com controles de câmera e zoom | `DONE` | 3 — Front-end | [BC-003](tasks/003-interactive-3d-graph.md) · [Proposta OpenSpec](../openspec/changes/interactive-3d-graph/proposal.md) |
| BC-004 | Adicionar testes de visualização, dados e regressão de API | `DONE` | 7 — QA | [BC-004](tasks/004-test-coverage.md) |
| BC-005 | Revisar acessibilidade, desempenho, segredos e configuração de build | `DONE` | 8 — Segurança/DevOps | [BC-005](tasks/005-hardening.md) |

## Sequência sugerida

1. **BC-001 — Processo de trabalho.** Aplicar os arquivos deste pacote, verificar a estrutura e registrar o commit de configuração.
2. **BC-002 — Spotify.** Validar OAuth, scopes, dados retornados e tratamento de erros 401/403/429; manter o modo demo utilizável sem credenciais.
3. **BC-003 — Grafo 3D.** Decidir e instalar a biblioteca compatível; tornar a visualização 3D a principal, com rotação, zoom por roda/gesto, pan, ajuste à tela e restauração da câmera.
4. **BC-004 — QA.** Cobrir transformação de payload, estados vazios/erro/loading, filtros, clique/hover e os dois modos do grafo.
5. **BC-005 — Hardening.** Validar build, acessibilidade, mobile, performance, dependências e ausência de credenciais versionadas.

## Critérios de conclusão do produto

- O fluxo demo funciona sem credenciais Spotify.
- Um usuário autorizado pode conectar-se e ver os dados pessoais permitidos pela API.
- A visualização principal é realmente 3D (eixos/profundidade/câmera), não apenas um grafo 2D com efeitos visuais.
- A pessoa consegue girar, aproximar/afastar e deslocar a câmera; existe ação clara para enquadrar o grafo e restaurar a visão.
- Os modos Artistas ↔ Artistas e Artistas ↔ Gêneros, períodos, filtros, destaque de vizinhança e painel analítico continuam operacionais.
- Erros de autenticação, permissões e rate limit são comunicados claramente.
- Testes e build aplicáveis passam e os resultados são documentados.

## Decisões pendentes

- Confirmar dependências/versões e optar entre `react-force-graph-3d` (interface semelhante à versão 2D já usada) ou composição própria com Three.js/React Three Fiber.
- Confirmar com a conta Developer do usuário que o App está habilitado no modo de desenvolvimento e que os endpoints necessários estão liberados.
- Definir se o grafo 2D será removido ou ficará como alternativa acessível. A preferência inicial é 3D como padrão; preserve uma alternativa 2D apenas se o custo de manutenção e acessibilidade fizer sentido.
