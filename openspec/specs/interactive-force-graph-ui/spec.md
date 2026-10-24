# Capability: Interactive Force-Directed Graph Visualization

## Requirements

### Requirement: Custom Canvas 2D Node Rendering (Artists & Genre Hubs)
A interface de visualização SHALL renderizar um grafo de força direcionada fluido em HTML5 Canvas onde:
- Nós do tipo `artist` são desenhados como círculos contendo a foto do artista (ou iniciais em fallback), com raio proporcional à afinidade/popularidade (`val`) e anel colorido de acordo com sua comunidade Louvain (`color`).
- Nós do tipo `genre` (no modo Bipartido) são desenhados como hexágonos estilizados com o rótulo `# GÊNERO`.

#### Scenario: Diferenciação visual entre Artistas e Gêneros no modo Bipartido
- **GIVEN** que o usuário selecionou o modo `"Artistas ↔ Gêneros (Bipartido)"`
- **WHEN** o Canvas renderiza os nós da rede
- **THEN** artistas aparecem como avatares circulares e gêneros aparecem como hubs hexagonais conectados aos seus respectivos artistas

---

### Requirement: Ego-Network Neighbor Highlighting on Hover & Click
Ao passar o mouse (`hover`) ou clicar em um nó, a interface SHALL destacar exclusivamente o nó focado, seus vizinhos imediatos (1-hop ego network) e as arestas incidentes (com partículas direcionadas animadas), reduzindo a opacidade dos demais elementos do grafo para `0.14`.

#### Scenario: Inspeção de vizinhança direta de um artista
- **GIVEN** o grafo renderizado na tela
- **WHEN** o usuário passa o mouse ou clica sobre um nó de artista
- **THEN** apenas os nós diretamente conectados a ele permanecem com opacidade `1.0`, a câmera centraliza no nó clicado e o painel lateral exibe a foto, ranking de afinidade, centralidade, gêneros e top faixas do artista

---

### Requirement: Real-Time Dynamic Controls & Analytical Sidebar
A interface SHALL disponibilizar controles dinâmicos sem recarregamento de página para:
1. Alternar entre os modos `Artistas ↔ Artistas` e `Artistas ↔ Gêneros (Bipartido)`.
2. Alternar entre os períodos `4 Semanas` (`short_term`), `6 Meses` (`medium_term`) e `Histórico` (`long_term`).
3. Filtrar arestas em tempo real através de um controle deslizante de limiar de força mínima (`minEdgeWeight`).
4. Exibir no painel lateral a Modularidade ($Q$), o número de conexões visíveis, o **Artista Mais Conector (Bridge Node)** e os principais clusters de gênero.

#### Scenario: Ajuste dinâmico do limiar de conexão
- **GIVEN** o grafo carregado em tela
- **WHEN** o usuário move o slider de limiar de `0.15` para `0.35`
- **THEN** todas as arestas com `weight < 0.35` são ocultadas instantaneamente e a física de forças reorganiza o layout
