# Capability: Graph Topology & Mathematical Engine

## Requirements

### Requirement: Composite Edge Weighting (TF-IDF + Collaborations + Session Co-listening)
No modo Unipartido (`graph_mode=artists`), o sistema SHALL calcular o peso $W(u, v) \in [0, 1]$ entre dois artistas $u$ e $v$ pela combinação convexa:
$$W(u, v) = 0.65 \cdot S_{\text{genre}}(u, v) + 0.25 \cdot S_{\text{collab}}(u, v) + 0.10 \cdot S_{\text{session}}(u, v)$$
Onde $S_{\text{genre}}(u, v)$ é a Similaridade de Cosseno sobre os vetores TF-IDF dos gêneros e radicais semânticos, $S_{\text{collab}}(u, v)$ mede colaborações diretas nas faixas do usuário, e $S_{\text{session}}(u, v)$ mede coocorrência temporal em janela deslizante ($w=3$) no histórico recente.

#### Scenario: Penalização de gêneros guarda-chuva via TF-IDF
- **GIVEN** dois artistas que compartilham apenas um gênero extremamente frequente no perfil do usuário (ex: `"rock"`) e outros dois artistas que compartilham um subgênero específico (ex: `"shoegaze"`)
- **WHEN** a matriz TF-IDF e a similaridade de cosseno são computadas
- **THEN** o par que compartilha `"shoegaze"` recebe maior peso $S_{\text{genre}}$ do que o par conectado apenas pelo termo genérico

---

### Requirement: Anti-Hairball Topological Sparsification (k-NN + Maximum Spanning Tree)
O sistema SHALL podar o grafo denso retendo apenas a união entre as $k$ arestas mais fortes de cada nó ($k=5$, com $W(u,v) \ge 0.12$) e a Árvore Geradora Máxima (*Maximum Spanning Tree* — MST) do grafo bruto.

#### Scenario: Preservação de pontes entre comunidades sem formar "bola de pelos"
- **GIVEN** um conjunto de 50 artistas com matriz de adjacência densa
- **WHEN** o filtro topológico $E_{\text{final}} = E_{k\text{-NN}} \cup E_{\text{MST}}$ é executado
- **THEN** o grafo resultante elimina arestas redundantes fracas mantendo os componentes conectáveis unidos através das arestas de maior peso da MST

---

### Requirement: Bipartite Artist-Genre Network Mode
Quando `graph_mode=bipartite`, o sistema SHALL construir um grafo bipartido $B = (U, V, E)$ onde $U$ representa os nós de Artistas (`node_type="artist"`) e $V$ representa os nós de Gêneros (`node_type="genre"`), conectando cada artista aos seus gêneros relevantes com peso proporcional ao *affinity score* do artista.

#### Scenario: Geração do grafo bipartido Artistas ↔ Gêneros
- **GIVEN** uma requisição `GET /api/graph?graph_mode=bipartite`
- **WHEN** o backend constrói a topologia bipartida
- **THEN** o JSON retornado contém nós com `node_type="artist"` e `node_type="genre"` (prefixados com `genre::`) e arestas do tipo `artist-genre`

---

### Requirement: Community Detection & Bridge Artist Identification
O sistema SHALL particionar o grafo em comunidades usando o algoritmo de **Louvain** ponderado por `weight`, calcular a modularidade $Q$ da rede, e identificar o **Artista Ponte** (*Bridge Artist*) através da maior Centralidade de Intermediação (*Betweenness Centrality*) com distância $d(u,v) = 1 / W(u,v)$.

#### Scenario: Cálculo de clusters e artista conector
- **GIVEN** o grafo construído em qualquer modo (`artists` ou `bipartite`)
- **WHEN** as métricas do `NetworkX` são processadas
- **THEN** cada nó recebe `cluster_id`, `color`, `degree_centrality` e `betweenness_centrality`, e o campo `metadata.bridge_artist` aponta para o artista com maior centralidade de intermediação
