# Proposta para a próxima etapa do BeatCode

Esta proposta separa as mudanças que precisam de decisão de produto ou arquitetura. Nenhum dos itens abaixo foi implementado nesta etapa.

## 1. Isolamento local de contas e OAuth

**Problema comprovado:** `backend/main.py` usa um único `.spotify_token_cache`. `/auth/status` e `/api/graph` leem esse mesmo arquivo para qualquer navegador. Além disso, `SpotifyOAuth.get_access_token(code)` consulta o cache por padrão; um novo callback pode reutilizar um token anterior em vez de trocar o código recebido.

**Proposta:** manter a aplicação local, mas criar sessões independentes por navegador com identificador aleatório em cookie `HttpOnly`, `SameSite=Lax` e `Secure` quando houver HTTPS. Cada sessão terá seu próprio `MemoryCacheHandler` do Spotipy e `state` OAuth de uso único. O callback validará cookie e `state`, trocará o código com `check_cache=False` e associará o token somente àquela sessão. O endpoint `/api/graph` exigirá a sessão correspondente; o modo demo continuará público. As sessões serão apagadas ao reiniciar o backend, com prazo de expiração e limite de memória. Não haverá banco de dados nesta fase.

**Aceite:** dois navegadores de teste com contas simuladas nunca obtêm os dados um do outro; callback sem cookie, `state` divergente ou repetido falha; token expirado exige reconexão ou é renovado apenas na própria sessão. Testes não usarão credenciais reais.

**Decisão necessária:** aprovar a mudança no fluxo de autenticação e o descarte dos tokens ao reiniciar o processo.

## 2. Next.js como interface principal

**Problema comprovado:** o README abre o Next.js em `:3000`, mas o callback OAuth redireciona por padrão para `:8000`, onde há outra interface. Isso divide o produto e duplica manutenção.

**Proposta:** após isolar sessões, redirecionar o callback para o Next.js e criar uma entrada com duas ações claras: conectar Spotify ou explorar o demo. Manter o grafo 2D como base imersiva, com painel de detalhes adaptável a telas pequenas, lista pesquisável acessível por teclado e explicação de arestas baseada nos componentes já retornados pela API. Preservar a interface HTML antiga apenas durante uma transição curta; removê-la após paridade verificada e aprovação específica.

**Aceite:** login retorna à mesma interface, demo funciona sem credenciais, ambos os modos e períodos funcionam, navegação básica por teclado e layout móvel são verificáveis em navegador.

**Decisão necessária:** confirmar Next.js como interface principal e a política de transição da página HTML.

## 3. Dependências do frontend

**Problema comprovado:** `npm audit` no lockfile atual aponta uma vulnerabilidade crítica no Next.js 14.2.35 e uma alta no PostCSS 8.4.31 aninhado sob o Next.js. O Next.js 14 está fora da política de suporte do mantenedor.

**Proposta:** migrar em mudança própria para Next.js 16.4.5 e React 19, validar `react-force-graph-2d`, `npm ci`, `npm run build`, `npm audit` e os fluxos em navegador. Documentar Node.js >=20.9. Como alternativa de transição, avaliar Next.js 15.5.29, mas sua janela de manutenção é mais curta. Não aplicar `npm audit fix --force` sem verificar o resultado.

**Decisão necessária:** aprovar a migração de versão principal de Next.js/React.

## 4. Modelo matemático: validar antes de alterar

**Observado no código e em ensaios controlados:**

- Gêneros usam TF-IDF com token exato duplicado e subtokens; o tokenizer padrão descarta termos de um caractere. Um artista com apenas `r&b` causa `ValueError: empty vocabulary`.
- Uma colaboração em uma faixa já produz `0.25 × 0.5 = 0.125`, suficiente para ultrapassar o limiar atual de `0.12`, mesmo sem gêneros semelhantes. Isso pode ser desejável, mas precisa de explicação visual.
- A sequência recente ignora `played_at`: duas faixas ouvidas com 48 horas de intervalo recebem coescuta normalizada `1.0` no ensaio. Coescuta isolada pesa no máximo `0.10`, abaixo do limiar `0.12`, portanto só reforça outras relações.
- A MST opera sobre arestas que já passaram pelo limiar; preserva conexões existentes, mas não une componentes separados por pesos menores que `0.12`.
- Louvain é uma heurística sobre modularidade. A betweenness do modo `artists` usa distância inversa do peso; a do modo `bipartite` ignora os pesos. O significado de “artista ponte” muda entre os modos.
- `affinity_score` deriva da posição do artista na lista, não de um score fornecido pelo Spotify. `popularity` e `genres` vêm do Spotify; pesos, clusters, centralidades e afinidade calculada são inferências do BeatCode.

**Proposta:** primeiro criar um pequeno conjunto de casos de referência e comparar pares esperados com os scores produzidos. Só então decidir, com exemplos, se uma janela temporal real, outra normalização, tratamento de gêneros curtos ou centralidade ponderada melhora o modelo. Exibir na interface a decomposição de cada aresta e um rótulo claro para dados do Spotify versus inferências. Não trocar coeficientes sem evidência.

**Decisão necessária:** aprovar qualquer alteração de fórmula ou semântica das métricas após revisão dos casos de referência.
