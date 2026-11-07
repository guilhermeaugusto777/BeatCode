# Representação de gêneros: correção e alternativas

## O que mudou

O grafo principal continua usando TF-IDF, cosseno, rótulo completo repetido duas vezes e subtermos, com os mesmos coeficientes e poda. A correção normaliza espaços, caixa, variantes de hífen e `&`, remove rótulos vazios e repetidos, e usa um tokenizer que preserva cada token delimitado por espaço. Assim, `r&b`, `hip_hop`, `drum_and_bass` e `k_pop` não são quebrados pela pontuação. Veja [a referência do tokenizer padrão do scikit-learn](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html): ele exige pelo menos dois caracteres alfanuméricos e ignora pontuação.

Exemplos de corpus: `R & B` vira `r&b r&b r&b`; `hip hop` vira `hip_hop hip_hop hip hop`; `drum and bass` vira `drum_and_bass drum_and_bass drum and bass`. A terceira ocorrência de `r&b` já existia como subtermo histórico. Rótulos duplicados de um mesmo artista não aumentam mais seu peso.

## Comparação antes da adoção

Resultados de `python -m experiments.compare_genres`, com 13 artistas sintéticos em três grupos conhecidos e o dataset demo de 26 artistas. Os modelos `hybrid` e `exact` permanecem isolados em `backend/experiments/`.

| Conjunto e modelo | Arestas | Peso médio | Comunidades | Ponte | Arestas novas/removidas vs anterior | Concordância com grupos conhecidos |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| Sintético, anterior | 27 | 0,407 | 3 | X | — | ARI 1,0 |
| Sintético, **compatível adotado** | 27 | 0,407 | 3 | X | 0/0 | ARI 1,0 |
| Sintético, híbrido sem conectores | 27 | 0,409 | 3 | X | 0/0 | ARI 1,0 |
| Sintético, apenas rótulos completos | 27 | 0,393 | 3 | X | 0/0 | ARI 1,0 |
| Demo, anterior | 61 | 0,280 | 3 | Gorillaz | — | Sem rótulos de referência |
| Demo, **compatível adotado** | 62 | 0,275 | 3 | Gorillaz | 1/0 | Sem rótulos de referência |
| Demo, híbrido sem conectores | 59 | 0,277 | 4 | Gorillaz | 4/6 | Sem rótulos de referência |
| Demo, apenas rótulos completos | 51 | 0,271 | 3 | Gorillaz | 2/12 | Sem rótulos de referência |

No demo, a correção acrescenta a aresta Gorillaz–Tyler, The Creator (peso 0,1698). O híbrido e o modelo por rótulo completo alteram mais a topologia; os resultados sintéticos não bastam para justificar essa mudança em dados reais.

## Limite conceitual ainda aberto

O modelo principal ainda trata palavras de rótulos como features independentes. `drum and bass` e `rhythm and blues` compartilham `and` e obtêm similaridade positiva sem um gênero Spotify comum; há um teste `xfail` específico. Outros subtermos, como `pop` em `k-pop` e `pop punk`, podem sinalizar relação musical ou só coincidência lexical. O modelo `exact` evita esses falsos positivos, mas também perde proximidade plausível entre subgêneros distintos. O híbrido remove conectores comuns, porém muda seis arestas do demo e cria quatro.

**Recomendação:** manter a correção compatível agora. Antes de trocar o modelo de gêneros, validar pares de artistas com avaliação humana e perfis reais consentidos, separando rótulos exatos de semelhança lexical. Uma taxonomia musical explícita seria potencialmente superior à separação por palavras, mas requer fonte confiável e manutenção; não há evidência nesta etapa para adotá-la.
