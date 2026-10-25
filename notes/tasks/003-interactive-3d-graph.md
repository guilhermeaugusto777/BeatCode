# BC-003 — Implementar visualização 3D interativa com controles de câmera e zoom

- **Estado:** `PLANNED`
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

- [ ] Avaliar `react-force-graph-3d` (compatibilidade React 18 / Next.js 14, versão, licença MIT, controles de câmera e fallback) e documentar decisão técnica.
- [ ] Carregar o componente WebGL exclusivamente no cliente (`dynamic(..., { ssr: false })`).
- [ ] Preservar contrato da API (`metadata`, `nodes`, `links`), modos `artists` e `bipartite`, períodos (`short_term`, `medium_term`, `long_term`), slider de limiar (`minEdgeWeight`) e modo demo.
- [ ] Diferenciar visualmente nós de `artist` e `genre` no espaço 3D e estilizar arestas proporcionalmente ao `weight`.
- [ ] Implementar controles explícitos de câmera (Zoom In, Zoom Out, Enquadrar grafo, Resetar visão) além de orbit/zoom/pan por mouse/gesto.
- [ ] Fornecer inspeção acessível de nós por teclado/lista sem depender exclusivamente de hover ou gestos 3D, respeitando `prefers-reduced-motion`.
- [ ] Detectar e tratar indisponibilidade de WebGL de forma observável e testável, mantendo acesso ao painel analítico e inspeção de nós.

## Critérios de aceite

- [ ] A visualização principal é 3D real com controles de orbit, zoom, pan, enquadrar e resetar visão.
- [ ] Os modos `artists` e `bipartite`, filtros, períodos, destaque de vizinhança 1-hop e painel analítico funcionam sem regressão.
- [ ] Há alternativa acessível para selecionar e inspecionar nós por teclado e fallback testável para WebGL indisponível.
- [ ] Testes e `npm run build` em `frontend/` passam e são registrados com evidências reais.
