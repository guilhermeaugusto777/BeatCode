# Proposta de exploração e interpretação do grafo

## O que já está disponível

No grafo **artista ↔ artista**, cada aresta da API contém `weight` (0 a 1), `shared_genres` e três componentes normalizados: `genre_similarity`, `direct_collaboration` e `co_listening`. A combinação atual é `0,65 × gênero + 0,25 × colaboração + 0,10 × coescuta`, antes do arredondamento. Um teste de referência confirma que os componentes reconstroem o peso retornado com tolerância ao arredondamento. O valor é **afinidade calculada pelo BeatCode**, não uma nota de similaridade fornecida pelo Spotify.

No grafo **artista ↔ gênero**, a ligação indica um rótulo de gênero fornecido pelo Spotify. O peso dessa aresta depende da posição do artista na lista de top artistas; não mede confiança da classificação do Spotify nem usa os três componentes do grafo de artistas. A interface deve explicar os modos separadamente. `affinity_score` também é uma transformação da posição no ranking, não uma medida direta de intensidade de escuta.

## Primeira melhoria visual recomendada

Ao selecionar uma **linha** entre artistas, abrir um painel compacto “Por que estão conectados?”. Mostrar os dois nomes, o peso final como “força da ligação calculada: 0,42/1” e três barras proporcionais à **contribuição ponderada** (`0,65g`, `0,25c`, `0,10t`), não aos componentes brutos. Assim o comprimento das barras soma aproximadamente o valor apresentado. Um texto curto por barra:

- **Gêneros em comum ou relacionados**: mostrar `shared_genres` quando houver; quando só houver termos relacionados por TF-IDF, dizer “rótulos de gênero com termos em comum”. Não inventar gêneros compartilhados.
- **Colaboração catalogada**: “Há uma faixa com ambos nos dados consultados” apenas quando o componente for positivo. A API ainda não envia nome nem ID da faixa que comprovou a colaboração; isso precisará de campo de evidência antes de mostrar exemplos.
- **Histórico recente**: “Apareceram próximos na lista recente” no modelo atual. Só usar “próximos no tempo” se o modelo temporal for aprovado e a aresta carregar informação de `played_at`. Evitar “você gosta dos dois” ou qualquer inferência causal.

Mostrar uma nota pequena: “As ligações são inferências; uma playlist, álbum ou reprodução automática pode influenciar o histórico”. Se um componente for zero, exibir “sem sinal neste recorte”, não “não existe relação”. O arredondamento pode fazer a soma visual diferir por até cerca de `0,001`.

O painel deve ser acessível por **clique/toque** e por uma lista textual de conexões do artista selecionado; Canvas sozinho não oferece foco de teclado nos links. Ao focar um artista pela lista, oferecer “ver conexões” com nomes, peso e botão para abrir a explicação. Em telas pequenas, usar folha inferior; em desktop, painel lateral que não cubra o grafo. A interação de hover pode servir de prévia, mas não pode ser o único caminho. Respeitar `prefers-reduced-motion` nas animações de foco e zoom.

## Ordem de entrega sugerida

1. **Explicar uma ligação selecionada** com os dados já presentes. É a melhoria de maior valor e menor custo; validar texto com algumas pessoas antes de acrescentar controles.
2. **Filtro de comunidade/gênero** com contagem de nós e arestas visíveis, botão “limpar filtros” e indicação de que a seleção altera a visualização, não os cálculos. Isso evita interpretar uma rede filtrada como resultado científico completo.
3. **Destaque de pontes** com rótulo “conecta partes da rede calculada”. Hoje a interface já exibe artista ponte e comunidades; melhorar a explicação antes de adicionar mais cores ou métricas. Betweenness depende dos pesos convertidos em distâncias e da poda do grafo.
4. **Evidências específicas** de colaboração e tempo somente após contrato de API e revisão de privacidade. O payload deve conter referências mínimas, nunca histórico completo de reprodução em tooltips ou logs.

## Critérios de aceitação para a interface futura

Conferir que a explicação reproduz o peso dentro da tolerância de arredondamento, não usa componentes no modo bipartido, diferencia dados do Spotify de cálculos do BeatCode, funciona por teclado e toque, mantém o grafo legível em largura de celular e não apresenta dados de outra sessão. Um teste de interface deve cobrir as duas modalidades e uma aresta sem gênero compartilhado literal.
