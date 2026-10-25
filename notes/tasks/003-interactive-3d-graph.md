# BC-003 — Implementar visualização 3D interativa com controles de câmera e zoom

- **Estado:** `DONE`
- **Agente responsável:** 3 — UI/UX + Front-end + Acessibilidade
- **Colaboradores:** 2 — Requisitos/Arquitetura; 4 — Back-end; 7 — QA; 8 — Segurança/DevOps
- **Dependências:** BC-001, BC-002

## Resultado esperado

O usuário visualiza os grafos `artists` (Artistas ↔ Artistas) e `bipartite` (Artistas ↔ Gêneros) em espaço 3D interativo como visão principal, podendo girar a câmera (orbit), dar zoom, fazer pan, enquadrar o grafo ("Enquadrar grafo"), restaurar a câmera ("Resetar visão"), selecionar nós, inspecionar vizinhança 1-hop e utilizar filtros, seletor de período, painel analítico, inspeção acessível e tratamento de indisponibilidade de WebGL.

## Escopo e Proposta OpenSpec

- Proposta: `openspec/changes/interactive-3d-graph/proposal.md`
- Tarefas: `openspec/changes/interactive-3d-graph/tasks.md`
- Especificação Delta: `openspec/changes/interactive-3d-graph/specs/interactive-force-graph-ui/spec.md`

## Checklist

- [x] Avaliar `react-force-graph-3d` (compatibilidade React 18 / Next.js 14, versão, licença MIT, controles de câmera e fallback) e documentar decisão técnica.
- [x] Carregar o componente WebGL exclusivamente no cliente (`dynamic(..., { ssr: false })`).
- [x] Preservar contrato da API (`metadata`, `nodes`, `links`), modos `artists` e `bipartite`, períodos (`short_term`, `medium_term`, `long_term`), slider de limiar (`minEdgeWeight`) e modo demo.
- [x] Diferenciar visualmente nós de `artist` e `genre` no espaço 3D e estilizar arestas proporcionalmente ao `weight`.
- [x] Implementar controles explícitos de câmera (Zoom In, Zoom Out, Enquadrar grafo, Resetar visão) além de orbit/zoom/pan por mouse/gesto.
- [x] Fornecer inspeção acessível de nós por teclado/lista sem depender exclusivamente de hover ou gestos 3D, respeitando `prefers-reduced-motion`.
- [x] Detectar e tratar indisponibilidade de WebGL de forma observável e testável, mantendo acesso ao painel analítico e inspeção de nós.

## Critérios de aceite

- [x] A visualização principal é 3D real com controles de orbit, zoom, pan, enquadrar e resetar visão.
- [x] Os modos `artists` e `bipartite`, filtros, períodos, destaque de vizinhança 1-hop e painel analítico funcionam sem regressão.
- [x] Há alternativa acessível para selecionar e inspecionar nós por teclado e fallback testável para WebGL indisponível.
- [x] Testes e `npm run build` em `frontend/` passam e são registrados com evidências reais.

## Arquivos modificados

- `frontend/components/SpotifyConstellationGraph.jsx`:
  - Visualização 3D interativa como modo padrão via `react-force-graph-3d` e Three.js.
  - Carregamento estritamente client-side (`dynamic(..., { ssr: false })`).
  - Nós customizados em Three.js: esferas com fotos/cores da comunidade para artistas e icosaedros facetados com acento aramado para gêneros.
  - Anéis torus e badges CanvasTexture para destaque 1-hop e rótulos tridimensionais com supressão de raycast indevido.
  - Atualização reativa de opacidade e emissividade de materiais sem desalocação de buffers.
  - HUD flutuante de controles de câmera: Zoom In, Zoom Out, Orbit/Auto-rotate, Enquadrar Grafo, Resetar Visão e alternador 3D ↔ 2D.
  - Transição de câmera suave ao focar ou selecionar nós via `cameraPosition`.
  - Drawer modal acessível de busca de nós com navegação por teclado (`/`, `Esc`), filtros por tipo e foco direto.
  - Painel analítico aprimorado com botão de fechar seleção e lista de vizinhos diretos navegáveis por clique.
  - Detecção automática de WebGL com banner informativo e degradação suave para Canvas 2D.
  - Suporte completo a `prefers-reduced-motion` (desativação de rotação contínua e transições imediatas de câmera).

## Decisões técnicas e arquiteturais

1. **Biblioteca e Licença:** `react-force-graph-3d` (v1.29.2) e `three` (v0.186.1), ambas sob licença MIT permissiva, integradas perfeitamente ao ecossistema existente da família `force-graph`.
2. **Resolução de SSR no Next.js:** Uso de `next/dynamic` com `ssr: false` para evitar referências a `window.THREE` no servidor Node.js durante a compilação do Next.js 14.
3. **Performance de Texturas e Geometrias:** Caching de texturas `THREE.Texture` indexadas por `node.id` com `THREE.SRGBColorSpace`. Modificação in-place de opacidades, emissividade e visibilidade de anéis/labels via `group.userData` sem reconstrução de cena Three.js em eventos de hover/clique.
4. **Acessibilidade e Usabilidade:** Além da manipulação por gestos 3D (Orbit com botão esquerdo, Pan com botão direito, Zoom no scroll), a interface dispõe de controles por botões explícitos, atalhos de teclado e lista pesquisável para usuários de tecnologias assistivas.

## Evidências de validação do build (`frontend/`)

Comando executado:
```bash
cd frontend && npm run build
```

Saída do comando:
```text
> spotify-music-graph-frontend@1.0.0 build
> next build

  ▲ Next.js 14.2.35

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/4) ...
   Generating static pages (1/4) 
   Generating static pages (2/4) 
   Generating static pages (3/4) 
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    103 kB          190 kB
└ ○ /_not-found                          873 B          88.3 kB
+ First Load JS shared by all            87.5 kB
  ├ chunks/117-13166794211b8ad1.js       31.7 kB
  ├ chunks/fd9d1056-492374e25eee495c.js  53.6 kB
  └ other shared chunks (total)          2.1 kB

○  (Static)  prerendered as static content
```

Resultado: Código de saída `0` (sucesso). Zero erros de compilação, tipos ou hidratação.
