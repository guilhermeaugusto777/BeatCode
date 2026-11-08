# Modelo matemático do BeatCode

Esta página descreve o cálculo **implementado hoje** em [`backend/main.py`](../backend/main.py) e [`backend/genre_representation.py`](../backend/genre_representation.py). O grafo é uma visualização exploratória construída pelo BeatCode; suas arestas não são uma medida de gosto ou uma recomendação fornecida pelo Spotify. Casos reproduzíveis e alternativas ainda experimentais estão em [Validação do modelo](validacao-do-modelo.md).

## Proveniência e interpretação

| Informação | Origem | Interpretação |
| --- | --- | --- |
| Artistas, ordem dos top artistas, gêneros, faixas, popularidade global e `played_at` | Spotify Web API, ou dataset local no modo demo | Dados recebidos para o recorte consultado. A ordem dos top artistas é ordinal. |
| `affinity_score`, tamanho dos nós, pesos e componentes das arestas | BeatCode | Transformações e heurísticas para construir a visualização. Não são probabilidades nem notas de afinidade do Spotify. |
| Comunidades, modularidade, grau e artista ponte | NetworkX aplicado ao grafo construído pelo BeatCode | Propriedades **da topologia calculada e podada**. Dependem de parâmetros, amostra e modo. |

O período `short_term`, `medium_term` ou `long_term` controla a consulta de top artistas e top faixas. O histórico de reproduções recentes vem de outro endpoint, limitado atualmente a uma página de até 50 itens, e **não acompanha esse período**. Faixas salvas complementam a detecção de colaborações. O modo demo usa registros definidos em `get_demo_dataset()`; seus números não representam uma conta real.

## Grafo de artistas (`artists`)

Cada nó é um artista do conjunto retornado. Para cada par distinto, o BeatCode calcula três componentes em `[0, 1]`:

1. **Gêneros, `g`:** cada rótulo Spotify é normalizado com Unicode NFKC, caixa uniforme, espaços, hífens e `&` padronizados; rótulos vazios e duplicados por artista são ignorados. O corpus repete duas vezes o rótulo completo com espaços convertidos em `_` e acrescenta subtermos de mais de dois caracteres. Exemplos: `r&b` permanece `r&b`; `hip hop` gera `hip_hop` e `hip`, `hop`; `drum and bass` gera `drum_and_bass`, `drum`, `and`, `bass`. `TfidfVectorizer(token_pattern=r"(?u)\S+")` constrói vetores TF-IDF no conjunto **daquela requisição**. A similaridade é o cosseno entre os vetores; a diagonal é zerada. Se todos os documentos de gênero estiverem vazios, a matriz é zero.
2. **Colaborações, `c`:** o backend reúne top faixas e faixas salvas, deduplica por ID e conta faixas com ambos os artistas entre os nós selecionados. `c = min(1, quantidade_de_faixas / 2)`. Uma faixa dá `0,5`; duas ou mais dão `1`. A evidência é participação na mesma faixa consultada, não preferência conjunta.
3. **Coescuta, `t`:** o backend usa o **primeiro artista** de cada faixa do histórico recente. Para cada posição, conta pares nas duas posições seguintes, excluindo o próprio artista, e divide todas as contagens pelo maior valor da matriz. **`played_at` não é usado.** Logo, duas reproduções adjacentes separadas por dias podem receber o mesmo sinal que duas separadas por minutos. “Coescuta” aqui significa proximidade na lista recebida, não proximidade temporal comprovada.

O peso bruto é calculado antes do arredondamento:

```text
W(u, v) = clip(0,65 × g(u, v) + 0,25 × c(u, v) + 0,10 × t(u, v), 0, 1)
```

Os coeficientes são **fixos**; as contribuições de uma aresta são `0,65g`, `0,25c` e `0,10t`. Por exemplo, para `g=1`, `c=0,5`, `t=0`, o peso é `0,775`, com contribuições `0,65`, `0,125` e `0`. Não se deve apresentá-las como porcentagens do gosto pessoal. A API arredonda o peso a quatro casas e cada componente a três; reconstruí-lo do JSON pode gerar diferença pequena de arredondamento. `shared_genres` contém apenas a interseção literal de rótulos originais; uma similaridade lexical positiva pode existir sem gênero literalmente compartilhado.

### Poda e métricas

1. Só pares com `W >= 0,12` entram no grafo elegível.
2. A poda retém a união da árvore geradora **máxima** desse grafo e das até cinco arestas mais fortes elegíveis de cada nó (`k=5`). Se o grafo elegível estiver desconexo, o resultado da árvore é uma **floresta**; a poda não cria ligações abaixo do limiar.
3. Louvain particiona o grafo podado com pesos e `seed=42`; a modularidade também é calculada nesse grafo. Comunidades e modularidade não demonstram, por si, categorias musicais percebidas por pessoas.
4. Para a centralidade de intermediação (*betweenness*), cada força `W` vira distância `1 / max(W, 0,0001)`. O “artista ponte” é o nó artista com maior valor normalizado nessa topologia. `degree_centrality` é o número de vizinhos dividido por `n−1` no grafo podado.

O controle de limiar do frontend oculta arestas **na visualização** depois da resposta da API. Ele não recalcula comunidades, modularidade ou artista ponte. Esses indicadores continuam descrevendo a rede completa recebida do backend.

## Grafo artista–gênero (`bipartite`)

Os nós formam dois conjuntos: artistas e gêneros. Só há arestas entre conjuntos; uma aresta significa que o Spotify atribuiu aquele rótulo de gênero ao artista. O backend inclui gêneros presentes em pelo menos dois artistas e, para um artista sem gênero compartilhado selecionado, inclui seu primeiro gênero. Portanto o grafo **não enumera todos os gêneros recebidos**. Gêneros são identificados por `genre::<rótulo>`.

Para um artista na posição de índice `i` entre `n` artistas, o peso da sua aresta para cada gênero selecionado é `round(0,35 + 0,65 × (1 − 0,70 × i/n), 3)`. Essa fórmula depende da posição no ranking; **não usa a combinação de gêneros, colaboração e coescuta** do grafo de artistas e não mede confiança do Spotify no gênero. Louvain e modularidade usam os pesos dessas arestas. A betweenness bipartida usa **número de passos, sem peso**, sobre nós artistas e gêneros; o artista ponte é escolhido entre os artistas. A centralidade dos dois modos não tem interpretação ou escala diretamente comparável.

Nos nós artistas de ambos os modos, `affinity_score = round(1 − 0,75 × i/n, 3)`. É uma transformação da posição, não um score disponibilizado pelo Spotify. O valor interno `1 − 0,70 × i/n` usado no peso bipartido é diferente do `affinity_score` exposto. Para nós de gênero, o campo representa a fração de artistas selecionados ligados ao gênero. O nome do campo é histórico e não deve ser lido como medida universal de afinidade.

## Limites metodológicos

- O TF-IDF aprende o vocabulário no próprio perfil; adicionar ou remover artistas pode alterar similaridades anteriores. Subtermos como `and` podem criar proximidade lexical artificial entre estilos distintos.
- Os coeficientes `0,65/0,25/0,10`, o limiar `0,12` e `k=5` são escolhas heurísticas, sem calibração externa em preferências humanas.
- A amostra de recentes é curta e não registra duração efetivamente ouvida ou intenção do usuário. Reprodução automática, playlists e álbuns podem afetar a sequência.
- Uma colaboração em faixa consultada é evidência de catálogo, mas não prova proximidade entre preferências musicais.
- Métricas de topologia variam com o recorte, a poda e o modo. Não compare modularidade ou “artista ponte” de `artists` e `bipartite` como se fossem a mesma medição.

Nenhuma alternativa temporal experimental é usada na API atual. As opções e seus resultados estão documentados em [Validação do modelo](validacao-do-modelo.md).
