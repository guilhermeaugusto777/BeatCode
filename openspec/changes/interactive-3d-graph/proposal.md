# Proposta: Interactive 3D Music Graph

## Por quê

A visualização atual do BeatCode usa `react-force-graph-2d`. O produto precisa apresentar os relacionamentos musicais em espaço tridimensional, permitindo aproximação/afastamento e exploração espacial sem perder filtros nem contexto analítico.

## O que muda

- O grafo passa a ser renderizado em 3D como visualização principal.
- A câmera oferece rotação/orbit, zoom, pan, enquadramento automático e restauração da visão inicial.
- Artistas e gêneros mantêm identidades visuais distintas; conexões e destaque de vizinhança continuam vinculados ao payload atual.
- Os controles de modo, período, limiar de aresta, painel analítico, loading, erros e modo demo são preservados.
- Uma alternativa acessível deve permitir inspecionar os metadados sem depender somente da posição espacial/gestos 3D.

## Abordagem técnica inicial

Avaliar primeiro `react-force-graph-3d`, que pertence à mesma família da biblioteca 2D atualmente usada e disponibiliza motor de forças 3D e controles de câmera. Antes de instalar, conferir versão, compatibilidade com React 18/Next.js, licença e dependências. Se houver bloqueio, comparar uma implementação Three.js/React Three Fiber e documentar a decisão na nota BC-003.

A montagem do componente WebGL deve ser client-side/dynamic no Next.js para evitar renderização no servidor de APIs do browser. Não alterar o contrato do backend sem necessidade: a entrada deve continuar aceitando `metadata`, `nodes` e `links`.

## Escopo fora desta proposta

- Não reconstruir o motor matemático NetworkX sem evidência de bug.
- Não adicionar funcionalidades de IA sem requisito claro.
- Não alterar ou ampliar o uso de dados do Spotify para além dos scopes necessários.
- Não remover o modo demo.

## Riscos e mitigação

- **WebGL/performance:** limitar custo de labels e texturas, testar 50 artistas e os gêneros do modo bipartido, oferecer mensagem/fallback para WebGL indisponível.
- **Interação complexa:** fornecer botões explícitos de zoom, reset e enquadramento além dos gestos.
- **SSR no Next.js:** importar o componente 3D com `dynamic(..., { ssr: false })`.
- **API Spotify:** verificar o acesso real a endpoints e erros 401/403/429 em BC-002; demo precisa funcionar sem acesso Spotify.
- **Acessibilidade:** não depender apenas de cor, posição espacial, hover ou arraste.

## Critérios de aceite de alto nível

Consultar `specs/interactive-force-graph-ui/spec.md` e `tasks.md` nesta proposta.
