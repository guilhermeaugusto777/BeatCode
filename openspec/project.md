# Project Context: Spotify Music Graph

## Purpose
Sistema full-stack de Ciência de Dados e Teoria dos Grafos que se conecta à API oficial do Spotify via OAuth 2.0, extrai o perfil de consumo musical do usuário nos três horizontes temporais (`short_term`, `medium_term`, `long_term`), modela redes complexas (Unipartida `Artistas ↔ Artistas` e Bipartida `Artistas ↔ Gêneros`) e renderiza uma visualização interativa de força direcionada (Force-Directed Graph).

## Tech Stack
- **Backend:** Python 3.11+, FastAPI, Uvicorn, Spotipy (Spotify Web API v1), NetworkX (grafos, árvore geradora máxima, centralidades e comunidades Louvain), Scikit-Learn (TF-IDF e Similaridade de Cosseno), NumPy.
- **Frontend:** Next.js 16 (React 19), `react-force-graph-2d`, `d3-force`, Tailwind CSS. A interface HTML5 Canvas antiga continua servida pelo FastAPI durante a transição.
- **Segurança & Autenticação:** OAuth 2.0 Authorization Code Flow com `state` por tentativa, sessões em memória por navegador e callback em `http://127.0.0.1:8000/auth/callback` no desenvolvimento local. O backend mantém os tokens; não há suporte a implantação pública multiworker nesta etapa.

## Architecture & Domain Conventions
1. **Sparsification & Anti-Hairball:** Arestas entre artistas nunca devem ser criadas por simples interseção booleana de gêneros. O peso $W(u, v) \in [0, 1]$ combina:
   - Similaridade de Cosseno sobre vetores TF-IDF de gêneros e sub-tokens ($\alpha = 0.65$)
   - Colaborações diretas em faixas do usuário ($\beta = 0.25$)
   - Coocorrência temporal em sessões recentes de escuta ($\gamma = 0.10$)
   - Poda topológica retendo a união entre os $k$-NN ($k=5$) de cada nó e a *Maximum Spanning Tree* (MST).
2. **Modos de Visualização:**
   - `artists` (Unipartido): Nós são apenas artistas; arestas representam proximidade composta.
   - `bipartite` (Bipartido): Dois conjuntos disjuntos de nós (`node_type="artist"` e `node_type="genre"`), destacando hubs de gênero.
3. **Métricas Topológicas:**
   - Detecção de comunidades via algoritmo de **Louvain** (`modularity_score`).
   - Identificação do **Artista Ponte** (*Bridge Node*) via maior *Betweenness Centrality* ponderada pela distância inversa ($d = 1 / W$).
