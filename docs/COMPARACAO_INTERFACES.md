# Comparação das interfaces

O Next.js é a interface principal. `backend/index.html` continua acessível localmente para comparação e ainda não foi removido.

| Função | HTML antigo | Next.js principal |
| --- | --- | --- |
| Grafo 2D, modos `artists` e `bipartite` | Sim | Sim |
| Períodos, limiar de arestas e modo demo | Sim | Sim |
| Cores de comunidades, painel de métricas e inspeção de artistas | Sim | Sim |
| Faixas e gêneros de um artista | Sim | Sim |
| Entrada sem credenciais | Demo automático | Escolha explícita entre Spotify e demo |
| Zoom e enquadramento | Mouse e clique | Mouse, clique e botões |
| Seleção por teclado | Não | Lista de artistas no painel |
| Logout por sessão | Não | Sim |
| Painel em tela móvel | Largura fixa | Abaixo do grafo |

A interface antiga ainda é útil como referência, mas seu fluxo de demo automático pode ocultar problemas de autenticação. A remoção deve esperar a validação do OAuth real com uma conta de teste e uma revisão final de paridade visual e funcional. O BeatCode não deve manter duas interfaces com evolução independente.
