# BeatCode — Instruções para agentes de desenvolvimento

## Objetivo do projeto

O BeatCode conecta-se à conta Spotify autorizada pelo usuário, transforma dados musicais em grafos e oferece análise topológica. A evolução prioritária é uma visualização **3D interativa**, com zoom, rotação, pan, seleção de nós e manutenção dos modos `artists` (Artistas ↔ Artistas) e `bipartite` (Artistas ↔ Gêneros).

## Leitura obrigatória antes de trabalhar

1. `README.md` — inicialização e comandos de execução.
2. `openspec/project.md` — arquitetura e domínio.
3. `openspec/AGENTS.md` e especificação da capacidade relacionada em `openspec/specs/`.
4. `notes/ROADMAP.md` e a nota específica em `notes/tasks/`.
5. `openspec/openapi.yaml` antes de alterar contrato/API.

Não assuma que a documentação esteja perfeitamente alinhada ao código: confirme as implementações reais antes de alterá-las.

## Orquestração dos oito agentes Maestri

O Agente 1 é o único responsável pela coordenação geral, definição da tarefa ativa, resolução de conflitos e integração. As conexões abaixo definem com quem cada agente deve colaborar; não significam que todos precisem ser acionados em toda tarefa.

| Agente | Responsabilidade | Conexões autorizadas |
|---|---|---|
| 1 — Tech Lead / Maestro | Decomposição, prioridades, arquitetura, integração e decisão final | 2, 3, 4, 5, 6, 7, 8 |
| 2 — Requisitos + Arquitetura | EARS, cenários de aceite, contratos e decisões arquiteturais | 1, 3, 4, 7 |
| 3 — UI/UX + Front-end + Acessibilidade | Interface, visualização 3D, responsividade e acessibilidade | 1, 2, 4, 7, 8 |
| 4 — Back-end + APIs | FastAPI, OAuth Spotify, endpoints, erros e integração | 1, 2, 3, 5, 6, 7, 8 |
| 5 — Banco de Dados | Persistência, modelos, migrações e privacidade dos dados | 1, 4, 7, 8 |
| 6 — IA e Agentes | Recursos de IA/agentes quando necessários; não adicionar IA sem requisito de produto | 1, 4, 7, 8 |
| 7 — QA / Testador | Testes, cenários de aceite, regressão e evidências | 1, 2, 3, 4, 5, 6, 8 |
| 8 — Revisor + Segurança + DevOps | Revisão independente, segredos, dependências, CI e deploy | 1, 3, 4, 5, 6, 7 |

### Regras de colaboração

- Antes de implementar, o Agente 1 cria/atualiza a nota da tarefa e descreve o resultado esperado, critérios de aceite, arquivos prováveis, riscos e testes.
- O Agente 2 esclarece requisitos/arquitetura antes de mudanças que cruzem camadas.
- Um agente é designado como **dono da implementação**. Não permita que agentes paralelos editem os mesmos arquivos simultaneamente; solicite revisões ou entregas isoladas para evitar conflitos.
- O Agente 7 executa testes e relata comandos e resultados reais. O Agente 8 revisa segurança e diff; ambos devem indicar claramente o que não conseguiram verificar.
- O Agente 1 decide se a feature satisfaz os critérios e coordena o commit.
- O Agente 6 só deve ser acionado quando houver requisito explícito de IA. A lógica principal do grafo deve permanecer determinística e testável.

## Ciclo obrigatório por feature

1. Registrar a tarefa em `notes/tasks/NNN-slug.md`, adicionar/linkar no `notes/ROADMAP.md` e marcá-la como `PLANNED`.
2. Conferir os requisitos em OpenSpec. Para uma mudança de comportamento, criar/atualizar uma proposta em `openspec/changes/<slug>/`.
3. Criar uma branch a partir da branch de base atual, usando nome curto, por exemplo `feat/graph-3d-controls` ou `fix/spotify-auth-refresh`.
4. Implementar uma feature coesa por vez. Não misturar refatorações sem relação na mesma entrega.
5. Executar os testes pertinentes, lint/build quando disponíveis, e revisar o diff. Nunca afirmar que um comando foi executado se não foi.
6. Atualizar a nota da tarefa com mudanças, resultados de teste, limitações e decisão de revisão; marcar `DONE` só quando os critérios de aceite passarem.
7. Fazer **um commit por feature implementada**, depois das verificações. Preferir Conventional Commits, por exemplo `feat(graph-3d): add orbit and zoom controls` ou `fix(spotify): handle rate limit responses`.
8. Não colocar segredos, tokens, cookies, `.env`, dados pessoais do Spotify nem dumps de respostas privadas no Git. Não force-push. Não faça commits de múltiplas features não relacionadas.
9. Ao finalizar, atualizar `notes/WORKLOG.md` e o estado do roadmap na mesma feature/commit. Se a feature falhar nos testes, registrar `BLOCKED` ou `IN_PROGRESS`; não marcar como concluída.
10. Não fazer push/merge em `main` automaticamente se as permissões, política do repositório ou fluxo de revisão não estiverem claros.

## Convenções de notas

- Estados válidos: `PLANNED`, `IN_PROGRESS`, `BLOCKED`, `DONE`.
- Cada nota de tarefa precisa incluir ID, estado, agente responsável, dependências, escopo, critérios de aceite, testes e log de implementação.
- O roadmap é o índice de navegação. O worklog é cronológico. A nota individual contém os detalhes executáveis.
- Mantenha tudo em Markdown para que GitHub, VS Code e editores de notas consigam exibir as tarefas visualmente com checkboxes.

## Contexto técnico atual conhecido

- Backend: Python + FastAPI + Spotipy + NetworkX + NumPy + scikit-learn.
- Frontend: Next.js 14 + React 18; o componente atual usa `react-force-graph-2d` e `d3-force`.
- O backend e o frontend vivem em diretórios separados. Execute `npm` dentro de `frontend/`; o repositório raiz não tem script `dev`.
- A API atual retorna `metadata`, `nodes` e `links`; preserve esse contrato salvo mudança formal no OpenAPI e aprovação dos agentes 2, 4 e 7.
- Mantenha tokens OAuth no servidor e fora do estado/armazenamento acessível ao cliente.
- A API do Spotify muda com frequência: valide documentação oficial e o acesso real aos endpoints antes de confiar em scopes, campos ou métodos antigos.
