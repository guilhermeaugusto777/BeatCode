# Revisão do modelo matemático atual

Esta etapa registra resultados reproduzíveis sem alterar fórmulas. Os exemplos são executados em `backend/tests/test_graph_reference.py`. Valores de grafo entre modos não devem ser comparados como se medissem a mesma coisa.

## Origem dos dados e das inferências

| Campo ou dado | Origem | Interpretação segura |
| --- | --- | --- |
| Artistas, gêneros, faixas, `popularity`, ordem de top artistas e `played_at` | Spotify Web API | Dados disponibilizados pelo Spotify para a conta e os escopos autorizados. A ordem de top artistas é ordinal. |
| `affinity_score`, tamanho do nó, pesos e componentes das arestas | BeatCode | Pontuações construídas para a visualização; não são afinidade publicada pelo Spotify nem probabilidade de gostar. |
| Comunidades, modularidade, graus e artistas ponte | BeatCode com NetworkX | Propriedades do grafo construído e podado; dependem da seleção de gêneros, pesos e limiar. |

## Casos de referência

| Entrada mínima | Saída atual observada | Consequência |
| --- | --- | --- |
| A e B só com `shoegaze` | Similaridade de gênero `1,0`; peso final `0,65` | O cosseno de documentos idênticos está correto. A parcela de gêneros domina a aresta. |
| A=`rock`, B=`jazz`, uma faixa com ambos | Colaboração normalizada `0,5`; peso `0,125`; a aresta passa no limiar padrão `0,12` | Colaboração direta, mesmo sem gênero comum, pode criar ligação. Isso representa um fato sobre a faixa, não necessariamente afinidade de escuta. |
| A e B ouvidos com 2 minutos de diferença; mesma sequência com 24 horas | Ambos recebem coescuta `1,0` e peso `0,1` (com limiar de teste `0,01`) | `played_at` é ignorado. O nome “coocorrência temporal” promete uma relação que o cálculo não verifica. |
| Dois artistas com único gênero `r&b` | `TfidfVectorizer` lança `ValueError: empty vocabulary` | O tokenizer padrão descarta tokens de um caractere separados por `&`; esse perfil pode produzir erro 500. É um defeito comprovado, coberto por teste `xfail`. |
| A=`rock, unique A`, B=`rock, unique B` no bipartido | Só o hub `rock` é criado, com duas arestas; os gêneros exclusivos são omitidos | O grafo bipartido é uma seleção de incidências, não um espelho completo dos gêneros recebidos. |
| Dois artistas por ordem de top artistas | `affinity_score` dos nós: `1,0` e `0,625`; peso bipartido do segundo artista para o gênero: `0,772` | O score do nó é uma transformação linear do ranking. O peso da aresta bipartida usa outra transformação interna (`0,70` em vez de `0,75`). |

## Avaliação dos componentes

**TF-IDF e cosseno.** A construção atual duplica o token exato do gênero e acrescenta palavras do nome. Isso ajuda a distinguir `indie rock` de `rock`, mas dá peso extra ao rótulo exato e depende do vocabulário do próprio perfil. A similaridade muda quando outros artistas entram ou saem do conjunto. O caso `r&b` comprova que a tokenização atual não é robusta. Antes de mudar o tokenizer, comparar a preservação literal de gêneros com pontuação, a estabilidade dos pesos em perfis distintos e o custo de recalibrar o limiar `0,12`.

**Colaborações.** A matriz conta faixas distintas com ambos os artistas, divide por dois e limita a `1,0`. Uma única faixa equivale a metade da evidência máxima. A soma convexa `0,65/0,25/0,10` é válida numericamente, mas os componentes têm semânticas distintas e a escolha dos coeficientes não está calibrada por avaliação externa. Mostrar os componentes no produto antes de sugerir que uma aresta é “afinidade”.

**Coescuta.** A janela deslizante usa posição na lista, não diferença entre `played_at`. Ela conecta os artistas da primeira faixa de cada item recente mesmo que a lacuna temporal seja longa; normaliza pela maior contagem observada no próprio lote. O endpoint de recentes fornece até 50 itens e não segue `time_range` dos top artistas. A alternativa a avaliar é ordenar por timestamp, limitar a diferença em minutos e documentar a janela, com comparação contra o resultado atual em perfis anonimizados.

**Poda e comunidades.** O k-NN (`k=5`) e a árvore geradora máxima são calculados depois de excluir arestas abaixo de `0,12`; portanto a “árvore” é uma floresta quando o grafo elegível é desconexo. O caso A=`rock`, B=`rock+jazz`, C=`jazz` com k-NN desligado mantém apenas A–B e B–C, com B como ponte. Louvain usa peso das arestas e seed fixa. A modularidade mede a separação do grafo *já podado*; não valida por si só se as comunidades correspondem a grupos musicais percebidos por pessoas.

**Betweenness.** No unipartido, o código converte força em distância `1/peso` antes do cálculo; um caminho com arestas fortes fica mais curto, o que é coerente com a interpretação de afinidade. No bipartido, o cálculo usa contagem de passos sem peso. Além disso, caminhos atravessam hubs de gênero e a normalização usa todos os nós dos dois tipos. Scores e “artista ponte” dos dois modos não têm escala ou significado diretamente comparáveis. O texto de `openspec/project.md` e a spec do motor descrevem distância inversa em ambos os modos; isso ainda não corresponde ao bipartido.

**`affinity_score`.** É `1 - 0,75 × índice / n` para os nós artistas. Não vem do Spotify e não usa frequência de escuta, tempo, salvamentos ou popularidade. Em um conjunto de 50 artistas, o último recebe `0,265`; em um conjunto de dois, o segundo recebe `0,625`. O nome sugere uma medição pessoal que não existe. O peso artista–gênero usa `1 - 0,70 × índice / n`, enquanto o campo exposto usa `0,75`.

## Recomendações para decisão futura

1. **Alta, esforço médio — corrigir tokenização de gêneros.** Prototipar tokenizer que preserve rótulos como `r&b`, `k-pop` e termos Unicode. Comparar pesos antigos/novos e recalibrar o limiar com casos de referência antes de aplicar.
2. **Alta, esforço médio — definir o que “coescuta” mede.** Se o objetivo é proximidade temporal, usar `played_at` com janela explícita; se é apenas adjacência no histórico, renomear componente e explicar a limitação.
3. **Alta, esforço baixo — tornar proveniência e semântica visíveis.** Distinguir dados Spotify de inferências BeatCode e explicar cada aresta. Considerar renomear `affinity_score` para uma indicação de rank, sem mudar seu valor até aprovação.
4. **Média, esforço médio — harmonizar a interpretação de centralidade.** Escolher e validar se o bipartido deve usar distância inversa, contagem de passos ou uma centralidade bipartida específica. Só então comparar ou apresentar artistas ponte entre modos.
5. **Média, esforço médio — avaliar estabilidade.** Rodar análise de sensibilidade dos coeficientes, limiar, k-NN e poda em casos sintéticos e perfis reais cedidos com consentimento. Medir mudança de arestas e comunidades, não apenas modularidade.

Nenhuma dessas recomendações altera o cálculo nesta etapa. A correção do caso `r&b` e qualquer alteração de fórmula ou contrato exigem aprovação específica.
