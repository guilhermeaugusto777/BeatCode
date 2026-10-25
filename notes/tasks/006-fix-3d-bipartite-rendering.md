# BC-006 — Correção da Renderização 3D Bipartida e Refinamento do Frontend

- **Estado:** `DONE`
- **Agente responsável:** 1 — Tech Lead / Maestro (Coordenação); 3 — UI/UX Front-end (Visualização e Three.js); 4 — Back-end (Enriquecimento e Grafo Bipartido); 7 — QA (Testes); 8 — Segurança/DevOps (Revisão)
- **Dependências:** BC-001, BC-002, BC-003, BC-004, BC-005

## Resultado esperado

O grafo no modo Artistas ↔ Gêneros (Bipartido) deve reproduzir a qualidade visual da Referência A:
1. Nós de Artistas e Gêneros com clara distinção visual no espaço 3D (esferas suaves com texturas/fotos para artistas e poliedros facetados com wireframe e halo luminoso para gêneros).
2. Rótulos de gêneros imediatamente visíveis e legíveis (sprites 3D permanentes/destacados nos hubs semânticos), sem depender de hover prévio.
3. Conexões/arestas visíveis, com contraste adequado contra o fundo escuro, espessura legível e destaque temático.
4. Iluminação 3D rica (AmbientLight + DirectionalLight + emissividade nos materiais) eliminando o aspecto de esferas pretas ou escuras.
5. Calibração da simulação de forças (amortecimento, centro de gravidade e atração) para evitar dispersão excessiva e manter o grafo enquadrado e agrupado em clusters visíveis.
6. Robustez no tratamento de dados reais do Spotify: quando a conta do usuário possuir artistas com poucos ou nenhum gênero retornado pela Web API, o backend deve enriquecer os gêneros e tratar ausências sem quebrar a estrutura bipartida, informando o usuário claramente caso não haja conexões.
7. Clareza no estado do Modo Demo vs Modo Real e tratamento de estados vazios.

## Diagnóstico da causa raiz

- **Frontend (Three.js / React Force Graph 3D):**
  - Rótulos de gênero estavam condicionados a `labelSprite.visible = isHighlighted`, ficando 100% invisíveis no estado inicial.
  - Ausência de iluminação customizada e materiais sem emissividade faziam poliedros e esferas escurecerem contra o fundo escuro (`#090A0F`).
  - As arestas tinham opacidade efetiva de 0.16 e cor cinza tenue, tornando-se quase invisíveis.
  - A força de repulsão (`charge: -170`) sem atrito ou força central dispersava os nós excessivamente.
- **Backend (FastAPI / NetworkX):**
  - Quando os artistas retornados pelo Spotify possuem listas vazias de gêneros (`genres: []`), o conjunto de gêneros selecionados ficava vazio, gerando zero nós de gênero e zero conexões.
  - Falta de enriquecimento via lote de artistas e ausência de alerta de "sem gêneros" nos metadados.

## Checklist

- [x] [Backend] Assegurar enriquecimento de gêneros e resiliência em `compute_bipartite_artist_genre_graph` para contas com poucos gêneros.
- [x] [Backend] Adicionar campo nos metadados reportando o status de conectividade de gêneros e fornecer fallback gracioso.
- [x] [Backend] Adicionar testes unitários específicos para grafos bipartidos com artistas com poucos/sem gêneros.
- [x] [Frontend] Configurar iluminação Three.js completa na cena do `ForceGraph3D` (AmbientLight + DirectionalLight + PointLight central).
- [x] [Frontend] Tornar os rótulos 3D dos hubs de gênero visíveis por padrão, com badges legíveis e contraste nítido.
- [x] [Frontend] Elevar a visibilidade, cor temática e espessura das arestas 3D.
- [x] [Frontend] Calibrar forças da simulação (`charge`, força de centralidade, amortecimento `warmupTicks`) para agrupamentos orgânicos.
- [x] [Frontend] Apresentar banner informativo gracioso se a conta do Spotify não possuir gêneros cadastrados no período.
- [x] [QA] Executar suíte de testes de regressão no backend (pytest) com 100% de sucesso.
- [x] [QA / DevOps] Executar `npm run build` no frontend garantindo zero erros de compilação.
- [x] [Segurança] Revisar ausência de vazamento de credenciais e sanitização.
- [x] [Maestro] Criar commit único convencional da feature.

## Critérios de aceite

- [x] Modo bipartido exibe artistas como esferas e gêneros como poliedros facetados iluminados.
- [x] Rótulos de gêneros visíveis e legíveis sem necessidade de clique prévio.
- [x] Arestas visíveis com contraste adequado no espaço tridimensional.
- [x] Simulação converge em clusters orgânicos sem dispersão desmedida.
- [x] Fallback gracioso com mensagem orientativa quando não houver gêneros no Spotify.
- [x] Testes do backend e build do frontend passam sem falhas.

## Log de implementação

- **2026-10-25 (Agente 4 — Back-end):**
  - Implementado enriquecimento em lote de gêneros via `sp.artists` em chunks de 50 IDs quando `current_user_top_artists` retorna artistas com `genres: []`.
  - Implementada resiliência completa em `compute_bipartite_artist_genre_graph`:
    - Adicionados campos de metadados `empty_genres` (booleano) e `genre_coverage` (percentual 0.0 - 1.0).
    - Se `selected_genres` for menor que 2, seleciona gêneros individuais restantes.
    - Se ainda for menor que 2 ou vazio, cria nós semânticos agregadores (`"eclético"`, `"variado"`), garantindo que todos os artistas se conectem e a bipartição permaneça equilibrada no espaço 3D.
  - Criado arquivo de testes dedicados `backend/tests/test_bipartite_graph.py` com 8 testes cobrindo todos os cenários de resiliência e enriquecimento.
  - Atualizado `backend/tests/test_topology_engine.py` para a nova resiliência topológica.
  - Executados todos os 54 testes do backend com 100% de aprovação no pytest.

- **2026-10-25 (Agente 3 — UI/UX + Front-end):**
  - Configurada iluminação rica Three.js (`AmbientLight`, `DirectionalLight` chave e preenchimento, e `PointLight` central temático).
  - Material dos nós de gênero agora possui emissividade nativa (`emissiveIntensity: 0.35`) e anel Torus permanente.
  - Rótulos 3D dos hubs de gênero agora permanecem sempre visíveis (`labelSprite.visible = true`) com resolução dobrada (512x128) e alto contraste.
  - Arestas 3D fortalecidas em espessura, opacidade (0.9) e contraste ciano/esmeralda para o modo bipartido.
  - Forças D3 calibradas (`charge: -110`, `link distance: 56`, `d3VelocityDecay: 0.35`, `warmupTicks: 45`) para agrupamento orgânico em clusters.
  - Banner informativo sutil adicionado para avisar o usuário caso a conta não tenha gêneros catalogados, com botão para explorar o modo Demo.

- **2026-10-25 (Agente 7 — QA Engineer / Testador):**
  - Executada a suíte completa de testes no backend: 54 testes executados, 54 testes aprovados (100% de sucesso).
  - Executado o build de produção do frontend (`npm run build`): 0 erros, páginas estáticas compiladas com sucesso.
  - Auditados todos os critérios de aceitação da BC-006: 100% em conformidade. Parecer formal de APROVAÇÃO emitido.

- **2026-10-25 (Agente 8 — Revisor de Código + Segurança + DevOps):**
  - Auditoria completa de segredos no git diff: sem vazamento de chaves ou variáveis .env.
  - Inspeção de segurança no backend e frontend: mitigação de CWE-79 (XSS) com escapeHtml mantida, canvas fillText seguro, lotes sp.artists com cap máximo de 50 e try/except resiliente.
  - Parecer formal de APROVAÇÃO emitido e commit liberado.
