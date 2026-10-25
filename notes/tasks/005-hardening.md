# BC-005 — Acessibilidade, desempenho e hardening

- **Estado:** `DONE`
- **Agente responsável:** 8 — Revisor de Código + Segurança + DevOps
- **Colaboradores:** 3 — Front-end/Acessibilidade; 4 — Backend; 7 — QA
- **Dependências:** BC-002 e BC-003

## Checklist

- [x] Revisar dependências novas, licença, compatibilidade com React 18 e vulnerabilidades conhecidas (`react-force-graph-3d` v1.29.2 e `three` v0.186.1 sob licença MIT).
- [x] Conferir segredos, `.env`, caches, `node_modules`, builds e bytecode no controle de versão.
- [x] Verificar `prefers-reduced-motion`, foco visível, controles com nomes acessíveis e interação alternativa aos gestos do mouse (busca por teclado com atalho `/`, drawer acessível e HUD flutuante).
- [x] Verificar contraste de rótulos e nós, painel analítico e mensagens de erro (alerta para WebGL indisponível, badges de comunidade e fallback 2D).
- [x] Evitar loops desnecessários de renderização/forças e controlar o custo de imagens/labels ([DEV-03] descarte e `dispose()` de `THREE.Texture` no desmonte para liberação de VRAM/GPU).
- [x] [SEC-03] Sanitizar strings interpoladas no tooltip HTML do grafo (`escapeHtml`) contra injeção de HTML e quebra de layout.
- [x] Confirmar build e instruções de execução (`npm run build` concluído com sucesso e zero erros).
- [x] Registrar achados com severidade e correções recomendadas.

## Critérios de aceite

- [x] Nenhum segredo ou dado privado entra no diff.
- [x] Há caminho utilizável sem depender exclusivamente de mouse/gestos 3D (busca acessível por teclado, navegação em lista de vizinhos e botões HUD de câmera).
- [x] Os checks disponíveis passam ou as falhas conhecidas estão explicitamente documentadas.

## Implementações realizadas pelo Agente 3 (Front-end & Acessibilidade)

1. **[SEC-03] Sanitização HTML em Tooltips (`frontend/components/SpotifyConstellationGraph.jsx`):**
   - Implementada função utilitária `escapeHtml(str)` para caracteres especiais (`&`, `<`, `>`, `"`, `'`).
   - Aplicada em `getNodeTooltip` para escapar `node.name`, `node.genres`, `node.affinity_rank`, `node.color` e `node.metrics.degree_centrality`.

2. **[DEV-03] Liberação de Memória de Texturas Three.js na Desmontagem:**
   - Adicionado efeito de unmount com `useEffect(() => { ... return () => { ... } }, [])`.
   - Percorre o mapa de texturas em cache `textures3D.current` e chama `texture.dispose()` em cada instância de `THREE.Texture`, liberando a memória alocada na GPU/VRAM do navegador.

3. **Validação do Build do Front-end:**
   - Executado `npm run build` dentro de `frontend/`.
   - Saída obtida com código de saída 0:
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
