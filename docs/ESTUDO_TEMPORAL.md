# Experimento de coescuta temporal

Os modelos em `backend/experiments/temporal_models.py` **não são usados pela API**. Reproduza os números com `python -m experiments.compare_temporal` dentro de `backend/` e os casos mínimos com `python -m pytest tests/test_temporal_experiments.py`.

## Dados disponíveis e limites

O [endpoint oficial de reproduções recentes do Spotify](https://developer.spotify.com/documentation/web-api/reference/get-recently-played) fornece `played_at`, aceita `before`/`after` e retorna até 50 itens por chamada. O BeatCode consulta hoje uma única página de até 50 itens. Esse endpoint não usa o `time_range` dos [top artistas](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks), e não fornece duração efetivamente ouvida nem prova de escolha consciente da faixa. Uma sequência próxima pode resultar de reprodução automática, álbum, playlist ou acaso. Portanto todos os modelos abaixo são **heurísticas de contexto de escuta**, não evidência direta de afinidade entre artistas.

## Modelos comparados

Todos consideram apenas o primeiro artista da faixa e pares separados por até duas posições na sequência, como o cálculo atual.

| Modelo | Regra de contribuição para um par | Limitação específica |
| --- | --- | --- |
| Atual | Conta adjacências; divide todas as contagens pelo máximo do perfil | Ignora `played_at`; o par mais frequente sempre vira `1`, mesmo quando separado por dias. |
| Sessão, lacuna de 30 min | Conta pares na mesma sessão, formada por lacunas consecutivas de até 30 min; limita soma a `1` | Duas faixas a 40 min podem estar na mesma sessão se houver uma faixa intermediária a 20 min de cada. |
| Decaimento, meia-vida de 30 min | Soma `2^(-diferença_em_minutos/30)` e limita a `1` | Não tem corte: uma lacuna longa ainda tem contribuição positiva, mesmo que quase zero. |
| Decaimento limitado | Aplica o decaimento apenas à mesma sessão e a pares com até 30 min de diferença | Combina duas escolhas heurísticas de parâmetro; precisa de validação externa. |

Os candidatos usam valores absolutos limitados a `1`, sem normalização pelo máximo da matriz. Isso preserva a distinção entre minutos e dias em perfis pequenos, mas significa que **não se pode trocar apenas a função temporal e presumir calibração idêntica** do coeficiente `0,10` e do limiar de aresta `0,12`.

## Casos mínimos reproduzíveis

Uma reprodução de A seguida por uma de B, sem gêneros ou colaboração:

| Separação | Atual | Sessão 30 min | Decaimento 30 min | Decaimento limitado 30 min |
| --- | ---: | ---: | ---: | ---: |
| 2 min | 1,0000 | 1,0000 | 0,9548 | 0,9548 |
| 2 h | 1,0000 | 0,0000 | 0,0625 | 0,0000 |
| 1 dia | 1,0000 | 0,0000 | ~0 | 0,0000 |

Uma meia-vida de 120 min sobe o valor de 2 h para `0,5`; uma lacuna de sessão de 180 min também passaria a tratar 2 h como mesma sessão. Esses parâmetros ainda não têm fundamento em comportamento observado de usuários.

## Efeito no grafo sintético

O conjunto fixo tem 13 artistas, três grupos musicais definidos na entrada, um artista ponte X, 12 reproduções em três blocos separados por dias e duas faixas colaborativas. ARI mede concordância entre as três comunidades conhecidas e a partição Louvain, excluindo X. Os grupos foram construídos para serem claros; ARI `1,0` aqui é teste de consistência, **não validação com gostos reais**.

| Configuração | Modelo | Arestas | Peso médio | Arestas entre grupos conhecidos | Louvain | Ponte | ARI |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |
| Limiar `0,12`, k=5 | Atual | 27 | 0,407 | 0 | 3 | X | 1,0 |
| Limiar `0,12`, k=5 | Sessão | 27 | 0,407 | 0 | 3 | X | 1,0 |
| Limiar `0,12`, k=5 | Decaimento | 27 | 0,402 | 0 | 3 | X | 1,0 |
| Limiar `0,08`, k=5 | Atual | 33 | 0,351 | **6** | 3 | X | 1,0 |
| Limiar `0,08`, k=5 | Sessão | 27 | 0,407 | 0 | 3 | X | 1,0 |
| Limiar `0,08`, k=5 | Decaimento limitado | 27 | 0,402 | 0 | 3 | X | 1,0 |

No limiar padrão, o componente temporal isolado não ultrapassa `0,12`, pois contribui no máximo `0,10`; a mudança altera pesos existentes, mas não cria arestas apenas por proximidade. Ao baixar o limiar para `0,08`, o modelo atual cria seis ligações entre blocos de escuta separados por dias. Louvain ainda recupera os grupos, mostrando que ARI ou modularidade sozinhos não detectam todas as relações difíceis de interpretar.

## Estabilidade e poda

Ao permutar dez vezes a ordem de entrada dos mesmos eventos e manter `played_at`, a similaridade Jaccard mínima de arestas com a ordem original, no limiar `0,08`, foi `0,628` para o modelo atual e `1,0` para os três modelos que ordenam por timestamp. Essa perturbação testa dependência da ordem da lista; o Spotify normalmente devolve o histórico ordenado, então **não é uma estimativa de instabilidade real da API**. X permaneceu ponte em todas as variações.

Com o modelo atual e limiar `0,08`, a poda por árvore máxima isolada (`k=0`) reteve 12 arestas; `k=2` reteve 17; `k=5`, 33. As seis arestas entre grupos só aparecem com `k=5`. A modularidade variou de `0,558` para `0,579` e depois `0,470`; pontuação maior não prova relação musical melhor. Com limiar `0,12` ou `0,20`, o mesmo cenário reteve 27 arestas. Para os modelos temporais novos, variar a janela de 2 a 5 posições não mudou as 27 arestas deste conjunto, porque os sinais de gênero e colaboração dominaram o limiar.

## Recomendação

**Manter o cálculo principal até validar perfis reais com consentimento.** Para um teste de produto posterior, priorizar o **decaimento limitado**: ele evita ligações entre dias, distingue 2 de 25 minutos e não conecta pontas distantes apenas porque houve uma faixa intermediária. Mostrar esse sinal como “reproduções próximas no histórico recente”, nunca como prova de gosto ou relação musical. Comparar estabilidade por conta, cobertura de timestamps, efeito da paginação, falsos positivos avaliados por pessoas e sensibilidade de lacuna/meia-vida antes de aprovar substituição. Os coeficientes `0,65/0,25/0,10` e o limiar de poda precisarão de recalibração conjunta.
