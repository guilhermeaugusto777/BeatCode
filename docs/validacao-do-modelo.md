# Validação, experimentos e limites do modelo

Esta página conserva os casos de referência e os resultados dos estudos originais de gêneros e coescuta. A [descrição do modelo vigente](modelo-matematico.md) separa o que a API calcula hoje das alternativas experimentais. Números abaixo vêm de datasets sintéticos ou do dataset demo, **não de uma validação clínica ou de preferências musicais reais**.

## Como reproduzir

Instale as dependências de desenvolvimento conforme o [README](../README.md). Na raiz do checkout:

```powershell
Push-Location backend
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m experiments.compare_genres
.\.venv\Scripts\python.exe -m experiments.compare_temporal
Pop-Location
```

Em outros sistemas, execute os mesmos módulos com `backend/.venv/bin/python` a partir de `backend/`. Os dados fixos estão em [`backend/experiments/synthetic_data.py`](../backend/experiments/synthetic_data.py), os modelos de gênero em [`backend/experiments/genre_representation.py`](../backend/experiments/genre_representation.py), os temporais em [`backend/experiments/temporal_models.py`](../backend/experiments/temporal_models.py) e os testes em [`backend/tests/`](../backend/tests/). A API usa apenas o modelo compatível de gênero e a coescuta atual.

## Casos mínimos do modelo vigente

| Entrada | Saída observada | Interpretação |
| --- | --- | --- |
| Dois artistas apenas com `shoegaze` | Similaridade de gênero `1,0`; peso `0,65` | Documentos TF-IDF idênticos têm cosseno 1; gênero domina esse par. |
| `rock` e `jazz`, com uma faixa de ambos | Colaboração `0,5`; peso `0,125`; passa o limiar `0,12` | Uma colaboração isolada pode criar aresta sem gênero compartilhado. |
| A e B adjacentes no histórico, separados por 2 min ou por 24 h | Coescuta `1,0` nos dois casos; peso isolado `0,1` com limiar de teste `0,01` | O método vigente ignora `played_at`. No limiar padrão, coescuta isolada não cria aresta. |
| Dois artistas com apenas `r&b` | O corpus preserva `r&b`; cálculo conclui sem vocabulário vazio | Defeito de tokenização corrigido, com teste de regressão. |
| A=`rock, gênero exclusivo A`, B=`rock, gênero exclusivo B` no bipartido | Hub `rock` e duas arestas | Gêneros exclusivos podem ficar fora por regra de seleção. |
| Dois artistas em ordem de ranking | `affinity_score` 1,0 e 0,625; peso bipartido do segundo ≈0,772 | O score do nó e o peso bipartido usam transformações diferentes do ranking. |

Os testes de referência em [`test_graph_reference.py`](../backend/tests/test_graph_reference.py) fixam o comportamento observado. Um teste marcado `xfail` em [`test_genre_representation.py`](../backend/tests/test_genre_representation.py) documenta a falsa similaridade lexical entre `drum and bass` e `rhythm and blues` causada por `and`. `xfail` é uma limitação conhecida, não uma falha corrigida.

## Representação de gêneros

A correção vigente normaliza rótulos, preserva termos completos como `r&b`, `hip_hop`, `drum_and_bass` e `k_pop`, e deduplica rótulos repetidos por artista. Ela mantém subtermos históricos para reduzir mudança na topologia. Os modelos `hybrid` (retira conectores comuns) e `exact` (usa rótulos completos) continuam **isolados em `backend/experiments/`**.

Resultados registrados por `python -m experiments.compare_genres`:

| Dataset e modelo | Arestas | Peso médio | Comunidades | Ponte | Arestas novas/removidas vs. anterior | ARI contra grupos conhecidos |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| Sintético, anterior | 27 | 0,407 | 3 | X | — | 1,0 |
| Sintético, **compatível vigente** | 27 | 0,407 | 3 | X | 0/0 | 1,0 |
| Sintético, híbrido | 27 | 0,409 | 3 | X | 0/0 | 1,0 |
| Sintético, exato | 27 | 0,393 | 3 | X | 0/0 | 1,0 |
| Demo, anterior | 61 | 0,280 | 3 | Gorillaz | — | Sem referência |
| Demo, **compatível vigente** | 62 | 0,275 | 3 | Gorillaz | 1/0 | Sem referência |
| Demo, híbrido | 59 | 0,277 | 4 | Gorillaz | 4/6 | Sem referência |
| Demo, exato | 51 | 0,271 | 3 | Gorillaz | 2/12 | Sem referência |

No demo, a correção acrescentou Gorillaz–Tyler, The Creator (`W≈0,1698`). O híbrido e o exato mudaram mais arestas. O ARI perfeito no sintético é esperado para comunidades desenhadas para serem separáveis; não comprova validade em perfis reais. O modelo exato remove a coincidência lexical de `and`, mas também pode perder afinidades plausíveis entre subgêneros. Uma taxonomia musical seria outra alternativa, condicionada a fonte e manutenção confiáveis.

## Coescuta: quatro modelos comparados

Todos consideram somente o primeiro artista da faixa e pares separados por até duas posições. A API usa apenas o primeiro modelo.

| Modelo | Regra | Limite próprio |
| --- | --- | --- |
| **Atual** | Conta adjacências e divide pelo máximo do lote | Não considera a diferença de tempo; o par mais frequente recebe 1 mesmo se separado por dias. |
| Sessões (lacuna de 30 min) | Conta pares na mesma sessão, formada por lacunas consecutivas de até 30 min; limita soma a 1 | Uma faixa intermediária pode manter na mesma sessão duas pontas separadas por mais de 30 min. |
| Decaimento (meia-vida de 30 min) | Soma `2^(−Δminutos/30)` e limita a 1 | Sem corte, lacunas longas ainda contribuem um valor positivo minúsculo. |
| Decaimento limitado | Usa decaimento apenas na mesma sessão e até 30 min entre o par | Reúne duas escolhas de parâmetro ainda sem calibração humana. |

Um único par A–B, sem outro sinal:

| Separação | Atual | Sessão | Decaimento | Decaimento limitado |
| --- | ---: | ---: | ---: | ---: |
| 2 minutos | 1,0000 | 1,0000 | 0,9548 | 0,9548 |
| 2 horas | 1,0000 | 0,0000 | 0,0625 | 0,0000 |
| 1 dia | 1,0000 | 0,0000 | ≈0 | 0,0000 |

Os candidatos temporais limitam a soma absoluta a 1, em vez de dividir pelo máximo do lote. Por isso a troca de função **não preservaria automaticamente a calibração** do coeficiente `0,10` nem do limiar `0,12`. O endpoint Spotify de reproduções recentes fornece `played_at`, mas a consulta atual usa só uma página de até 50 itens; não fornece duração efetivamente ouvida ou intenção, e não compartilha `time_range` com top artistas.

## Impacto sobre comunidades, pontes e poda

O dataset fixo tem 13 artistas: três grupos definidos (rock, jazz e eletrônico), um artista ponte X, duas faixas colaborativas e 12 reproduções em três blocos separados por dias. ARI compara Louvain com os três grupos conhecidos, excluindo X.

| Limiar; k | Coescuta | Arestas | Peso médio | Arestas entre grupos | Louvain | Ponte | ARI |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |
| 0,12; 5 | Atual | 27 | 0,407 | 0 | 3 | X | 1,0 |
| 0,12; 5 | Sessão | 27 | 0,407 | 0 | 3 | X | 1,0 |
| 0,12; 5 | Decaimento | 27 | 0,402 | 0 | 3 | X | 1,0 |
| 0,08; 5 | Atual | 33 | 0,351 | **6** | 3 | X | 1,0 |
| 0,08; 5 | Sessão | 27 | 0,407 | 0 | 3 | X | 1,0 |
| 0,08; 5 | Decaimento limitado | 27 | 0,402 | 0 | 3 | X | 1,0 |

No limiar padrão, a contribuição temporal isolada é no máximo `0,10` e não abre arestas sozinha. Com limiar `0,08`, o modelo vigente cria seis ligações entre blocos separados por dias, embora Louvain e ARI permaneçam iguais. Isso demonstra por que uma métrica global sozinha não valida cada aresta.

Dez permutações da ordem dos mesmos eventos, mantendo `played_at`, deram similaridade Jaccard mínima de arestas `0,628` para o modelo atual e `1,0` para os três candidatos que ordenam por timestamp, com limiar `0,08`. É um **teste artificial de dependência da ordem**, não estimativa de instabilidade do Spotify; X permaneceu ponte. Com o modelo atual e limiar `0,08`, a árvore máxima isolada (`k=0`) reteve 12 arestas, `k=2` reteve 17 e `k=5` reteve 33; as seis ligações entre grupos só aparecem em `k=5`. A modularidade variou de `0,558` para `0,579` e `0,470`, respectivamente; maior modularidade não prova relação musical melhor. Com limiar `0,12` ou `0,20`, esse cenário reteve 27 arestas. Variar a janela dos candidatos de 2 a 5 posições não mudou as 27 arestas no limiar `0,12`, pois gêneros e colaborações dominaram.

## Critério para uma mudança futura

Manter a fórmula vigente até comparar, com consentimento, perfis reais e julgamentos humanos de pares interpretáveis. O decaimento limitado é um **candidato de experimento**, pois evita conexão entre dias e distingue minutos próximos, mas ainda precisa de avaliação de cobertura de timestamps, paginação, sensibilidade de meia-vida e lacuna, estabilidade por perfil, falsos positivos e recalibração conjunta dos coeficientes e da poda. Nenhum resultado sintético autoriza afirmar que artistas conectados são musicalmente próximos ou que o usuário prefere ambos.
