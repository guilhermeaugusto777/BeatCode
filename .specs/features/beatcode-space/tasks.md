# BeatCode Space Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/beatcode-space/design.md`
**Status**: Approved
**Build**: `npm --prefix frontend run lint; npm --prefix frontend run build`
**Run backend**: `python -m pytest -o pythonpath=backend -v backend/tests`
**Run frontend**: `node --test frontend/tests/spaceGraphModel.test.mjs`
**Run e2e**: `node frontend/tests/e2eSpaceBrowser.mjs`

---

## Test Coverage Matrix

> Generated from codebase, project guidelines (`AGENTS.md`, `README.md`), and spec - confirm before Execute.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Spatial Domain, Math & Explainability (`frontend/lib/spaceGraphModel.js`) | unit | All deterministic formulas, 4-attribute edge composition, 1-hop/2-hop scoring, provenance, fallbacks | `frontend/tests/spaceGraphModel.test.mjs` | `node --test frontend/tests/spaceGraphModel.test.mjs` |
| Client Persistence (`frontend/lib/spacePreferences.js`) | unit | Defensive parsing, bounds clamping, zero-secret invariant, storage fallback | `frontend/tests/spaceGraphModel.test.mjs` | `node --test frontend/tests/spaceGraphModel.test.mjs` |
| Backend Graph & OAuth API (`backend/main.py`, `openspec/openapi.yaml`, `backend/tests/test_api.py`) | integration | Live `/api/graph` verification of `connected_artists_count`, Spotify vs. BeatCode provenance, and OAuth sessions | `backend/tests/test_*.py` | `python -m pytest -o pythonpath=backend -v backend/tests` |
| 3D/2D UI, WebGL Renderer & Camera/Inspector Integration (`frontend/components/**`, `frontend/app/globals.css`) | integration | WebGL fallback to 2D Canvas, `webglcontextlost`/`webglcontextrestored`, GPU disposal, `prefers-reduced-motion`, renderer-camera-inspector flow, lint & build | `frontend/tests/spaceGraphModel.test.mjs` | `node --test frontend/tests/spaceGraphModel.test.mjs && npm --prefix frontend run lint && npm --prefix frontend run build` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit/integration model tests | `node --test frontend/tests/spaceGraphModel.test.mjs` |
| Full | After tasks with backend/contract integration | `python -m pytest -o pythonpath=backend -v backend/tests` |
| Build | After UI/renderer tasks or phase completion | `npm --prefix frontend run lint && npm --prefix frontend run build` |

---

## Execution Plan

Tasks are organized into 3 dependency waves (DAG) to maximize concurrent execution across the configured Maestri specialists with strict single-file ownership (`1 file = 1 owner`) and zero file contention. **`Revisor de Código + Segurança + DevOps`** remains 100% independent of code authoring across `T1`–`T10` to serve as the independent **Verifier** (`Author != Verifier`).

### Specialist Role Alignment (Exclusively Configured Maestri Functions)

- **`Engenheiro de IA e Agentes`**: Owns **T1** (`frontend/lib/spaceGraphModel.js`) — acts strictly within its configured specialty (deterministic vs. probabilistic AI boundary, mathematical synthesis and explainability of the 4-attribute edge weight formula `0.65g + 0.25c + 0.10t` + `shared_genres`, 1-hop/2-hop multi-path relevance scoring $A_{2\text{hop}}$, deterministic normalization/fallbacks, and provenance tagging `[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]`).
- **`Engenheiro de Banco de Dados local`**: Owns **T2** (`frontend/lib/spacePreferences.js`) — client storage schema (`beatcode_space_prefs_v1`), clamping, FIFO eviction, zero-secret invariant, and memory fallback.
- **`Desenvolvedor Back-end + APIs e Integrações`**: Owns **T3** (`backend/tests/test_api.py` + `backend/main.py` + `openspec/openapi.yaml` contract verification for `connected_artists_count` and provenance).
- **`UI/UX Designer + Desenvolvedor Front-end + Acessibilidade`**: Owns all CSS design tokens, Three.js 3D WebGL rendering, and React `.jsx` components: **T4** (`frontend/app/globals.css`), **T6** (`frontend/components/space/PlanetaryRenderer.js`), **T7** (`frontend/components/space/SpaceHudControls.jsx`), **T8** (`frontend/components/space/SpaceInspectorPanel.jsx`), and **T9** (`frontend/components/SpotifyConstellationGraph.jsx`).
- **`QA`**: Owns **T10** (`frontend/tests/spaceGraphModel.test.mjs`) — automated unit, integration, and browser E2E verification suite covering `C1`–`C13` and `C15` (while `C14` runs via `pytest` in `backend/tests/test_api.py`).
- **`Analista de Requisitos + Arquiteto de Software`**: Owns **T5** (`frontend/package.json` + `frontend/package-lock.json` dependency locking, explicitly authorized by user to prevent concurrency with `T3`) plus specification/architecture governance (`spec.md` & `design.md`).
- **`Revisor de Código + Segurança + DevOps`**: Independent **Verifier** (`Author != Verifier`); performs security, performance, WebGL disposal, and architectural verification after `T1`–`T10`.

### Phase 1: Wave 1 — Independent Foundation (5 Concurrent Tasks, Depends on: None)

- **T1** (`frontend/lib/spaceGraphModel.js`) — Owner: `Engenheiro de IA e Agentes`
- **T2** (`frontend/lib/spacePreferences.js`) — Owner: `Engenheiro de Banco de Dados local`
- **T3** (`backend/tests/test_api.py` + `backend/main.py` + `openspec/openapi.yaml`) — Owner: `Desenvolvedor Back-end + APIs e Integrações`
- **T4** (`frontend/app/globals.css`) — Owner: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade`
- **T5** (`frontend/package.json` + `frontend/package-lock.json`) — Owner: `Analista de Requisitos + Arquiteto de Software`

### Phase 2: Wave 2 — Parallel 3D Renderer & Observatory HUD/Inspector Modules (3 Modules)

- **T6** (`frontend/components/space/PlanetaryRenderer.js`) — Owner: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade` (Depends on: `T1, T5`)
- **T7** (`frontend/components/space/SpaceHudControls.jsx`) — Owner: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade` (Depends on: `T1, T4`)
- **T8** (`frontend/components/space/SpaceInspectorPanel.jsx`) — Owner: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade` (Depends on: `T1, T4`)

### Phase 3: Wave 3 — Universe Integration, End-to-End Verification Suite & Independent Review

- **T9** (`frontend/components/SpotifyConstellationGraph.jsx`) — Owner: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade` (Depends on: `T2, T3, T6, T7, T8`)
- **T10** (`frontend/tests/spaceGraphModel.test.mjs`) — Owner: `QA` (Depends on: `T1, T2, T6, T9`)

### Phase 4: Wave 4 — Knowledge Graph Evolution & Interaction Hardening (Graphify Delta)

- **T11** (`frontend/components/space/PlanetaryRenderer.js` + `frontend/app/globals.css`) — Owner: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade` (Depends on: `T6, T9`)
- **T12** (`frontend/lib/spaceGraphModel.js`) — Owner: `Engenheiro de IA e Agentes` (Depends on: `T1`)
- **T13** (`frontend/lib/spaceGraphModel.js` + `frontend/components/space/SpaceHudControls.jsx` + `frontend/components/space/SpaceInspectorPanel.jsx`) — Owner: `Desenvolvedor Back-end + APIs e Integrações` (Depends on: `T1, T7, T8, T9`)
- **T14** (`frontend/components/SpotifyConstellationGraph.jsx`) — Owner: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade` (Depends on: `T9`)
- **Post-Wave Verification** — Owner: `Revisor de Código + Segurança + DevOps` (Verifier) + `QA` (`check_proofs.py` & `validate_verification.py`)

```
T1 -> T6
T5 -> T6
T1 -> T7
T4 -> T7
T1 -> T8
T4 -> T8
T2 -> T9
T3 -> T9
T6 -> T9
T7 -> T9
T8 -> T9
T1 -> T10
T2 -> T10
T6 -> T10
T9 -> T10
T6 -> T11
T9 -> T11
T1 -> T12
T1 -> T13
T7 -> T13
T8 -> T13
T9 -> T13
T9 -> T14
```

---

## Task Breakdown

### Phase 1: Wave 1 — Independent Foundation

#### T1: Implement pure spatial math, 4-attribute edge explainability, and provenance model

**What**: Create the pure domain and AI explainability module implementing deterministic planetary radii ($R_{\text{planet}} \in [3.50, 14.00]$ unipartite, $[3.00, 12.00]$ bipartite), genre stellar core radii ($R_{\text{star}} \in [5.83, 15.00]$), atmospheric halo radiation $\Phi(u) = 0.70\sqrt{C_B} + 0.30C_D$, orbital ring eligibility ($\text{Div}_{\text{cluster}} \ge 0.30$ or `bridge_artist`), 3D Fibonacci cluster centroids $\mathbf{C}_k$, 4-attribute edge weight decomposition (`0.65g + 0.25c + 0.10t` + qualitative `shared_genres` classification), 1-hop/2-hop multi-path ranking $A_{2\text{hop}}$, provenance tagging (`[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]`), reduced-motion config (`computeMotionConfig`), WebGL fallback state machine (`resolveWebGLFallbackState`), 3D camera target calculation (`resolveCameraFlightTarget`), missing-attribute fallback defaults, and `escapeHtml`.
**Where**: `frontend/lib/spaceGraphModel.js`
**Owner**: `Engenheiro de IA e Agentes`
**Depends on**: None
**Reuses**: Mathematical formulas from `docs/REVISAO_MODELO_MATEMATICO.md` and `docs/PROPOSTA_INTERPRETABILIDADE.md`
**Requirement**: SPACE-01, SPACE-02, SPACE-03, SPACE-04, SPACE-05, SPACE-06, SPACE-07, SPACE-09, SPACE-10

**Done when**:

- [x] Exports `computePlanetVisualProps`, `computeClusterCentroids`, `decomposeEdgeWeight`, `filterSpaceGraph`, `computeNodeNeighborhood`, `buildNodeProvenanceProfile`, `deriveExplorationDepth`, `resolveCameraFlightTarget`, `computeMotionConfig`, `resolveWebGLFallbackState`, and `escapeHtml`
- [x] Enforces all deterministic formulas, normalization bounds, and missing/invalid attribute fallback defaults from `spec.md` with zero DOM or Three.js imports
- [x] Gate check passes: `node -e "import('./frontend/lib/spaceGraphModel.js').then((m) => { if (!m.computePlanetVisualProps || !m.decomposeEdgeWeight) process.exit(1); })"`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(space-model): implementa modelo matematico deterministico e explicabilidade 1-hop/2-hop`

---

#### T2: Implement safe client preference storage manager

**What**: Create the defensive client storage module for `beatcode_space_prefs_v1` with bounds clamping (`min_edge_weight` in `[0.05, 0.65]`), FIFO `recent_planets` cap (max 10), zero-secret invariant (strips any accidental `access_token`, `refresh_token`, or `beatcode_session` keys), and in-memory fallback when `localStorage` is blocked.
**Where**: `frontend/lib/spacePreferences.js`
**Owner**: `Engenheiro de Banco de Dados local`
**Depends on**: None
**Reuses**: Storage safety rules from `AGENTS.md`
**Requirement**: SPACE-09, SPACE-10

**Done when**:

- [x] Exports `DEFAULT_SPACE_PREFERENCES`, `sanitizeSpacePreferences`, `loadSpacePreferences`, `saveSpacePreferences`, and `recordVisitedPlanet`
- [x] Never throws when storage is unavailable or contains malformed JSON
- [x] Gate check passes: `node -e "import('./frontend/lib/spacePreferences.js').then((m) => { if (!m.loadSpacePreferences) process.exit(1); })"`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(space-prefs): adiciona persistencia local segura de preferencias espaciais`

---

#### T3: Normalize and verify `connected_artists_count` and data provenance in backend API, OpenAPI, and integration tests

**What**: Ensure `backend/main.py` explicitly sets `"connected_artists_count"` on every `GraphNode` (`int >= 1` on `genre` nodes in `bipartite` mode and `None` on `artist` nodes in both `artists` and `bipartite` modes), document `connected_artists_count: { type: [integer, "null"] }` under `GraphNode` in `openspec/openapi.yaml`, and add the integration test `test_graph_endpoint_delivers_connected_artists_count_and_provenance_contract` in `backend/tests/test_api.py` verifying live `/api/graph` responses for both modes and distinguishing Spotify-originated fields from BeatCode-inferred fields.
**Where**: `backend/tests/test_api.py`
**Owner**: `Desenvolvedor Back-end + APIs e Integrações`
**Depends on**: None
**Reuses**: `backend/main.py` (`compute_unipartite_artist_graph`, `compute_bipartite_artist_genre_graph`) and `openspec/openapi.yaml`
**Requirement**: SPACE-01, SPACE-06

**Done when**:

- [x] `backend/main.py` returns `"connected_artists_count": None` on artist nodes and `"connected_artists_count": int >= 1` on genre nodes
- [x] `connected_artists_count` is documented under `GraphNode` in `openspec/openapi.yaml`
- [x] Integration test `test_graph_endpoint_delivers_connected_artists_count_and_provenance_contract` passes in `backend/tests/test_api.py`: `python -m pytest -o pythonpath=backend -v backend/tests`

**Tests**: integration
**Gate**: full
**Commit**: `feat(api-contract): normaliza e testa connected_artists_count e proveniencia no /api/graph`

---

#### T4: Add BeatCode Space cosmic design tokens and reduced-motion styles

**What**: Extend global stylesheet with deep-space color variables (`--space-void`, `--space-nebula-bg`, `--space-hud-surface`), glassmorphic Observatory HUD classes, provenance badge classes (`[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]`), subtle starfield/nebula backgrounds, and `@media (prefers-reduced-motion: reduce)` rules.
**Where**: `frontend/app/globals.css`
**Owner**: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade`
**Depends on**: None
**Reuses**: Design system from `docs/PESQUISA_VISUAL_BEATCODE_SPACE.md`
**Requirement**: SPACE-02, SPACE-08, SPACE-10

**Done when**:

- [x] Defines cosmic surface tokens, HUD glassmorphism utilities, provenance badge styles, and reduced-motion overrides
- [x] Gate check passes: `npm --prefix frontend run lint`

**Tests**: integration
**Gate**: build
**Commit**: `feat(ui-tokens): adiciona tokens espaciais e regras reduced-motion do BeatCode Space`

---

#### T5: Add and lock `three` and `react-force-graph-3d` in frontend package manifest and lockfile

**What**: Register `three` and `react-force-graph-3d` in `frontend/package.json` (`dependencies`), synchronize and commit the versioned lockfile (`frontend/package-lock.json`), and add the `test:unit` script for running the Node test suite.
**Where**: `frontend/package.json`
**Owner**: `Analista de Requisitos + Arquiteto de Software`
**Depends on**: None
**Reuses**: Historical 3D dependency configuration validated with Next.js 16
**Requirement**: SPACE-01, SPACE-09

**Done when**:

- [x] `three` and `react-force-graph-3d` are present in `frontend/package.json` and locked in `frontend/package-lock.json`
- [x] Gate check passes: `npm --prefix frontend run lint`

**Tests**: integration
**Gate**: build
**Commit**: `chore(deps): adiciona e trava three e react-force-graph-3d no frontend`

---

### Phase 2: Wave 2 — Parallel 3D Renderer & Observatory HUD/Inspector Modules

#### T6: Create Three.js 3D planetary renderer, starfield, WebGL context listener, and GPU disposal module

**What**: Create the Three.js renderer module generating artist planet spheres (with Spotify photo texture or procedural bands), atmospheric Fresnel halos, tilted orbital rings, octahedron genre stellar hubs, crisp LOD label sprites, background cosmic starfield, 3D cluster forces, `webglcontextlost`/`webglcontextrestored` event bindings (`attachWebGLContextListeners`), and deterministic GPU memory cleanup (`disposeThreeUniverse`).
**Where**: `frontend/components/space/PlanetaryRenderer.js`
**Owner**: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade`
**Depends on**: T1, T5
**Reuses**: `frontend/lib/spaceGraphModel.js`
**Requirement**: SPACE-01, SPACE-02, SPACE-09, SPACE-10

**Done when**:

- [x] Exports `createPlanetObject3D`, `createCosmicStarfield`, `configureSpaceForces3D`, `attachWebGLContextListeners`, and `disposeThreeUniverse`
- [x] Tracks all created geometries, materials, textures, and sprites in a resource registry and disposes 100% of them in `disposeThreeUniverse`
- [x] Gate check passes: `npm --prefix frontend run lint`

**Tests**: integration
**Gate**: build
**Commit**: `feat(space-3d): implementa renderizador planetario Three.js, contexto WebGL e limpeza GPU`

---

#### T7: Create Observatory HUD top bar, search/filter controls, and 360° camera dock

**What**: Create the compact spatial HUD component providing graph mode switch, time range selector, edge threshold slider, search bar (`/` shortcut) with node type filter, 3D/2D view toggle, exploration depth indicator (`Universo` / `Sistema Estelar` / `Órbita Planetária`), and 360° camera dock (`+`, `−`, `Centralizar`, `Visão Geral do Universo`, `Auto-Órbita`, `Legenda`).
**Where**: `frontend/components/space/SpaceHudControls.jsx`
**Owner**: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade`
**Depends on**: T1, T4
**Reuses**: `frontend/lib/spaceGraphModel.js`
**Requirement**: SPACE-03, SPACE-04, SPACE-07, SPACE-08, SPACE-09

**Done when**:

- [x] Renders accessible controls with `aria-pressed`, keyboard focus, and exploration depth indicator
- [x] Gate check passes: `npm --prefix frontend run lint`

**Tests**: integration
**Gate**: build
**Commit**: `feat(space-hud): cria barra de observacao espacial, busca e controles de camera 360`

---

#### T8: Create contextual Planet Inspector sidebar, 4-attribute edge breakdown, and Cosmic Legend

**What**: Create the contextual sidebar displaying topological metrics (`Modularidade Q`, `Artista Ponte`), interactive Star System (`clusters`) filter/focus pills, selected planet details with explicit provenance badges (`[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]`), 4-attribute edge weight decomposition (`0.65g + 0.25c + 0.10t` + qualitative `shared_genres` badge), 1-hop and 2-hop planet navigation buttons, and the toggleable Cosmic Legend.
**Where**: `frontend/components/space/SpaceInspectorPanel.jsx`
**Owner**: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade`
**Depends on**: T1, T4
**Reuses**: `frontend/lib/spaceGraphModel.js`
**Requirement**: SPACE-04, SPACE-06, SPACE-07, SPACE-08

**Done when**:

- [x] Displays 100% real node and edge data with `[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]` badges, 4-attribute connection breakdown, and 1-hop/2-hop jump buttons
- [x] Gate check passes: `npm --prefix frontend run lint`

**Tests**: integration
**Gate**: build
**Commit**: `feat(space-inspector): adiciona painel contextual de planetas, decomposicao 4-atributos e legenda`

---

### Phase 3: Wave 3 — Universe Integration & End-to-End Verification Suite

#### T9: Integrate 3D/2D BeatCode Space universe, camera controller, and WebGL fallback/recovery in main graph component

**What**: Integrate `ForceGraph3D`, `ForceGraph2D`, `PlanetaryRenderer`, `SpaceHudControls`, `SpaceInspectorPanel`, `spaceGraphModel`, and `spacePreferences` inside `SpotifyConstellationGraph.jsx` with smooth 3D camera centering on planets and star systems, keyboard shortcuts (`/` and `Escape`), reduced-motion enforcement, and automatic WebGL unavailability/context-loss fallback and restoration.
**Where**: `frontend/components/SpotifyConstellationGraph.jsx`
**Owner**: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade`
**Depends on**: T2, T3, T6, T7, T8
**Reuses**: `frontend/lib/spaceGraphModel.js`, `frontend/lib/spacePreferences.js`, `frontend/components/space/PlanetaryRenderer.js`, `frontend/components/space/SpaceHudControls.jsx`, `frontend/components/space/SpaceInspectorPanel.jsx`
**Requirement**: SPACE-01, SPACE-02, SPACE-03, SPACE-04, SPACE-05, SPACE-06, SPACE-07, SPACE-08, SPACE-09, SPACE-10

**Done when**:

- [x] Renders both 3D Space Universe and 2D Cartographic views while preserving selection and filters across switches
- [x] Handles WebGL unavailability and `webglcontextlost`/`webglcontextrestored` with automatic fallback to 2D Canvas, recovery, and status banner
- [x] Build gate passes: `npm --prefix frontend run lint && npm --prefix frontend run build`

**Tests**: integration
**Gate**: build
**Commit**: `feat(space-view): integra universo 3D BeatCode Space com fallback WebGL e navegacao orbital`

---

#### T10: Create unit and integration test suite for math model, WebGL fallback/recovery, GPU disposal, reduced motion, and renderer-camera-inspector flow

**What**: Create the comprehensive automated test suite (`frontend/tests/spaceGraphModel.test.mjs`) verifying all deterministic formulas and missing-attribute defaults (`C1`, `C2`, `C3`), camera depth transitions (`C4`), XSS sanitization (`C5`), 4-attribute edge weight decomposition and 2-hop multi-path ranking (`C6`), search/cluster/threshold filtering (`C7`), client preferences resilience (`C8`), WebGL unavailability fallback to 2D Canvas (`C9`), `webglcontextlost` and `webglcontextrestored` recovery (`C10`), Three.js geometry/material/texture/sprite disposal via `disposeThreeUniverse` (`C11`), `prefers-reduced-motion` behavior (`C12`), and integrated interaction between renderer, 3D camera controller, and inspector panel (`C13`).
**Where**: `frontend/tests/spaceGraphModel.test.mjs`
**Owner**: `QA`
**Depends on**: T1, T2, T6, T9
**Reuses**: `frontend/lib/spaceGraphModel.js`, `frontend/lib/spacePreferences.js`, `frontend/components/space/PlanetaryRenderer.js`
**Requirement**: SPACE-01, SPACE-02, SPACE-03, SPACE-04, SPACE-05, SPACE-06, SPACE-07, SPACE-08, SPACE-09, SPACE-10

**Done when**:

- [x] All 13 frontend unit and integration proofs (`C1`–`C13`) pass under `node --test frontend/tests/spaceGraphModel.test.mjs`
- [x] Combined with backend integration proof `C14` (`pytest`), all 14 checks (`C1`–`C14`) pass with 0 failures: `node --test frontend/tests/spaceGraphModel.test.mjs && python -m pytest -o pythonpath=backend -v backend/tests && npm --prefix frontend run lint && npm --prefix frontend run build`

**Tests**: integration
**Gate**: quick
**Commit**: `test(space): adiciona suite de testes unitarios e de integracao WebGL, GPU, motion e inspector`

---

### Phase 4: Wave 4 — Knowledge Graph Evolution & Interaction Hardening (Graphify Delta)

#### T11: Implement Graphify-inspired 3D Knowledge Graph visual model and clean `#050508` dark canvas

**What**: Refactor the 3D visual presentation to align with Graphify: remove decorative planetary atmospheric halos and Saturn-like rings, eliminate procedural background starfield/dust particles, enforce discreet calm `#050508` background canvas, render clean 3D node meshes (spheres with high-definition avatars and clean polyhedral hubs for genres), and render subtle convex hulls for active knowledge clusters.
**Where**: `frontend/components/space/PlanetaryRenderer.js` & `frontend/app/globals.css`
**Owner**: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade`
**Depends on**: T6, T9
**Reuses**: Three.js geometry/material caching and Graphify visual design guidelines
**Requirement**: SPACE-01, SPACE-02, SPACE-10

**Done when**:

- [ ] 3D canvas renders with background `#050508` without starry particle clutter
- [ ] Node meshes render clean spheres and polyhedra without decorative planetary halos or orbital rings
- [ ] Gate check passes: `npm --prefix frontend run lint`

**Tests**: integration
**Gate**: build
**Commit**: `feat(knowledge-graph): implementa modelo visual 3D inspirado no Graphify e fundo discreto`

---

#### T12: Implement deterministic linear listening sizing and deduplicated genre aggregation in domain model

**What**: Update `frontend/lib/spaceGraphModel.js` with the strictly linear listening sizing formula $D_i = D_{\max} \cdot (L_i / L_{\max})$, $R_i = D_i / 2$, verifying exact ratios ($1000$ vs $500 \implies 2.0\times$, $1000$ vs $750 \implies 1.3333\times$, $1500$ vs $1000 \implies 1.5\times$), enforcing separate scales ($D_{\max,\text{artist}} = 28.0, R_{\max,\text{artist}} = 14.0$ vs $D_{\max,\text{genre}} = 24.0, R_{\max,\text{genre}} = 12.0$), aggregating genre listening volume ($L_g$) by deduplicating track play counts across unique songs, and assigning safe fallback $R_{\min,\text{safe}} = 2.0$ with `isFallbackListening = true` for missing/invalid $L_i \le 0$ or `NaN` without distorting the positive linear ratios.
**Where**: `frontend/lib/spaceGraphModel.js`
**Owner**: `Engenheiro de IA e Agentes`
**Depends on**: T1
**Reuses**: Mathematical specification from `spec.md` Section 2
**Requirement**: SPACE-01, SPACE-06

**Done when**:

- [ ] `computePlanetVisualProps` computes strictly linear radii $R_i$ from $L_i$ with verified ratios ($2.0\times, 1.3333\times, 1.5\times$)
- [ ] Genre play counts $L_g$ deduplicate multi-artist tracks in the same genre
- [ ] Nodes with $L_i \le 0$ receive `isFallbackListening: true` and $R_{\min,\text{safe}} = 2.0$ without offsetting positive linear nodes
- [ ] Gate check passes: `node --test frontend/tests/spaceGraphModel.test.mjs`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(sizing-model): implementa dimensionamento linear as escutas e agregacao deduplicada de generos`

---

#### T13: Implement genre graph fixes: auto-bipartite switching, genre-genre projections, and full neighborhood

**What**: Implement cohesive genre exploration: update `SpaceHudControls.jsx` and `SpotifyConstellationGraph.jsx` to automatically switch `graphMode` to `"bipartite"` whenever the user filters by `genre`, project weighted `genre-genre` edges ($W(g_1, g_2) = \frac{|A(g_1) \cap A(g_2)|}{|A(g_1) \cup A(g_2)|}$) in `filterSpaceGraph`, and preserve the complete bipartite neighborhood (all incident artists and connection weights) in `SpaceInspectorPanel.jsx`.
**Where**: `frontend/lib/spaceGraphModel.js`, `frontend/components/space/SpaceHudControls.jsx`, `frontend/components/space/SpaceInspectorPanel.jsx`
**Owner**: `Desenvolvedor Back-end + APIs e Integrações`
**Depends on**: T1, T7, T8, T9
**Reuses**: Domain graph filtering and inspector components
**Requirement**: SPACE-01, SPACE-06, SPACE-07

**Done when**:

- [ ] Selecting `genre` filter automatically comutes graph mode to `bipartite`
- [ ] `filterSpaceGraph` projects `genre-genre` edges based on shared artists Jaccard similarity
- [ ] `SpaceInspectorPanel` displays complete bipartite neighborhood without truncated connections
- [ ] Gate check passes: `node --test frontend/tests/spaceGraphModel.test.mjs && npm --prefix frontend run lint`

**Tests**: integration
**Gate**: quick
**Commit**: `feat(genre-graph): adiciona comutacao automatica bipartida, projecao genre-genre e vizinhanca completa`

---

#### T14: Implement hover camera zoom stability with `hasInitialFitRef` and stable callback refs

**What**: Eliminate camera zoom loss and unexpected resets when hovering over nodes in `frontend/components/SpotifyConstellationGraph.jsx`. Implement `hasInitialFitRef` to ensure `zoomToFit` inside `onEngineStop` executes once and only once upon initial load, and wrap hover/click handlers (`onNodeHover`, `onLinkHover`, `onNodeClick`) in stable refs (`useRef` / `useCallback`) so `<ForceGraph3D>` props do not re-instantiate or trigger canvas re-centering on hover.
**Where**: `frontend/components/SpotifyConstellationGraph.jsx`
**Owner**: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade`
**Depends on**: T9
**Reuses**: Component lifecycle hooks and ForceGraph3D integration
**Requirement**: SPACE-03, SPACE-04, SPACE-09

**Done when**:

- [ ] Hovering over nodes in 3D mode maintains manual camera zoom, pan, and rotation without resetting
- [ ] `hasInitialFitRef` restricts `zoomToFit` exclusively to the first initial graph stabilization
- [ ] Gate check passes: `npm --prefix frontend run lint && npm --prefix frontend run build`

**Tests**: integration
**Gate**: build
**Commit**: `fix(camera-stability): corrige perda de zoom no hover com hasInitialFitRef e refs estaveis`

---

## Checks

**C1** - Unipartite artist nodes compute deterministic 3D planet radius in `[3.50, 14.00]`, atmospheric halo radiation $\Phi(u) = 0.70\sqrt{C_B} + 0.30C_D$, orbital ring eligibility ($\text{Div}_{\text{cluster}} \ge 0.30$ or `bridge_artist`), and safe fallback defaults for missing/`NaN` attributes (SPACE-01, AC 1, AC 4)
Proof: run frontend | ok 1 - SPACE-01 AC1/AC4: computePlanetVisualProps calculates deterministic planet radius, halo, orbital ring, and missing-attribute defaults

**C2** - Bipartite mode differentiates artist planets ($R_{\text{planet}} \in [3.00, 12.00]$, `connectedArtistsCount: null`) from genre stellar cores ($R_{\text{star}} \in [5.83, 15.00]$ scaled by `connected_artists_count`) and provides procedural surface fallback when `image_url` is absent (SPACE-01, AC 2, AC 4)
Proof: run frontend | ok 2 - SPACE-01 AC2/AC4: computePlanetVisualProps differentiates artist planets from genre star cores scaled by connected_artists_count

**C3** - Community clusters generate deterministic 3D Fibonacci spherical star-system centroids $\mathbf{C}_k$ scaled by Louvain modularity score $Q$ ($R_{\text{galaxy}} = 220 \cdot (1 + 1.8 \max(0, Q))$) (SPACE-02, AC 3)
Proof: run frontend | ok 3 - SPACE-02 AC3: computeClusterCentroids distributes star systems in 3D Fibonacci sphere scaled by modularity

**C4** - Exploration depth state and camera target controller transition deterministically between `"Universo"`, `"Sistema Estelar"`, and `"Órbita Planetária"` when focusing a planet, a cluster centroid, or resetting to overview (SPACE-03, AC 2, SPACE-04, AC 3, AC 4)
Proof: run frontend | ok 4 - SPACE-03/SPACE-04: deriveExplorationDepth and resolveCameraFlightTarget resolve planet orbit, star system centroid, and universe overview

**C5** - Hover tooltip HTML sanitizer (`escapeHtml`) neutralizes `<script>` and HTML attribute injection while preserving display text (SPACE-05, AC 1)
Proof: run frontend | ok 5 - SPACE-05 AC1: escapeHtml neutralizes XSS vectors in 3D tooltips and labels

**C6** - Edge explainability engine computes exact 4-attribute weight composition ($C_g = 0.65g, C_c = 0.25c, C_t = 0.10t$ + qualitative `shared_genres` match classification) and ranks 1-hop direct connections and 2-hop indirect connections via $A_{2\text{hop}}(u, z) = 1 - \prod_m (1 - 0.70 W_{um} W_{mz})$ (SPACE-06, AC 2, AC 3)
Proof: run frontend | ok 6 - SPACE-06 AC2/AC3: decomposeEdgeWeight and computeNodeNeighborhood verify 4-attribute 0.65g+0.25c+0.10t+shared_genres and 2-hop harmonic ranking

**C7** - Search and filter engine filters nodes and trajectories deterministically by query (name/genre), node type (`artist`/`genre`), `hidden_clusters`, and `minEdgeWeight` bounds (SPACE-07, AC 1, AC 2)
Proof: run frontend | ok 7 - SPACE-07 AC1/AC2: filterSpaceGraph filters deterministically by search query, node type, hidden clusters, and edge weight threshold

**C8** - Client preferences manager persists and restores `view_mode` (`space_3d` / `map_2d`), clamps out-of-range weights, enforces zero-secret storage, and falls back safely when `localStorage` throws (SPACE-09, AC 1)
Proof: run frontend | ok 8 - SPACE-09 AC1: spacePreferences preserves view state, clamps bounds, strips secrets, and survives blocked localStorage

**C9** - WebGL unavailability detection automatically switches `view_mode` from `space_3d` to 2D Canvas (`map_2d`) with a non-blocking status banner while preserving graph filters and selection (SPACE-09, AC 2)
Proof: run frontend | ok 9 - SPACE-09 AC2: resolveWebGLFallbackState falls back to 2D Canvas when WebGL is unavailable and preserves graph state

**C10** - WebGL context loss (`webglcontextlost`) prevents default unhandled crash, transitions cleanly to 2D Canvas fallback, and recovers 3D availability upon `webglcontextrestored` without losing selected node or filters (SPACE-09, AC 2)
Proof: run frontend | ok 10 - SPACE-09 AC2: attachWebGLContextListeners and resolveWebGLFallbackState handle webglcontextlost and webglcontextrestored recovery

**C11** - Three.js universe disposal (`disposeThreeUniverse`) traverses and disposes 100% of registered geometries, materials, textures, and label sprites on unmount or scene rebuild (SPACE-10, AC 4)
Proof: run frontend | ok 11 - SPACE-10 AC4: disposeThreeUniverse disposes all registered Three.js geometries, materials, textures, and sprites

**C12** - Reduced motion mode (`prefers-reduced-motion: reduce` or user toggle) disables orbital auto-rotation, directional edge particles, halo pulse oscillation, and camera flight interpolation duration (`cameraTransitionMs = 0`) (SPACE-10, AC 3)
Proof: run frontend | ok 12 - SPACE-10 AC3: computeMotionConfig enforces prefers-reduced-motion across rotation, particles, pulse, and camera flight

**C13** - Integrated interaction flow between 3D planetary renderer, camera flight controller, and contextual inspector panel synchronizes planet selection, `[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]` provenance profile, 1-hop/2-hop planet jumps, cluster focus, and universe reset (SPACE-03, SPACE-04, SPACE-06)
Proof: run frontend | ok 13 - SPACE-03/04/06: integrated renderer, camera controller, and inspector flow synchronizes planet selection, provenance, and 1-hop/2-hop navigation

**C14** - Backend `/api/graph` endpoint integration test verifies explicit delivery of `connected_artists_count` (`int >= 1` on genre nodes in `bipartite` mode, `None` on artist nodes) and preserves Spotify-originated vs. BeatCode-inferred fields alongside isolated OAuth session security (SPACE-01, SPACE-06)
Proof: run backend | test_graph_endpoint_delivers_connected_artists_count_and_provenance_contract PASSED

**C15** - Browser E2E verification validates live BeatCode Space 3D/2D rendering, demo mode entry, planet selection, 360° camera/HUD controls, contextual Inspector provenance badges (`[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]`), and 1-hop/2-hop navigation (SPACE-01, SPACE-03, SPACE-04, SPACE-06, SPACE-09)
Proof: run e2e | E2E_BROWSER_VERIFIED: 3D/2D stage, planet selection, camera HUD, and Inspector verified in headless browser

**C16** - Deterministic linear listening sizing computes strictly linear node radii ($D_i = D_{\max} \cdot (L_i / L_{\max})$, $R_i = D_i / 2$) verifying $1000$ vs $500 \implies 2.0\times$, $1000$ vs $750 \implies 1.3333\times$ ($4/3$), $1500$ vs $1000 \implies 1.5\times$, separate scales for artists ($D_{\max}=28.0, R_{\max}=14.0$) and genres ($D_{\max}=24.0, R_{\max}=12.0$), deduplicated genre play count aggregation ($L_g$), and safe fallback $R_{\min,\text{safe}} = 2.0$ with `isFallbackListening: true` for $L_i \le 0$ / `NaN` without corrupting positive ratios (SPACE-01, AC 1, AC 2)
Proof: run frontend | ok 16 - SPACE-01 AC1/AC2: computePlanetVisualProps enforces linear listening sizing, separate scales, deduplicated genre listening, and safe fallback

**C17** - Graphify-inspired clean 3D knowledge graph visual model renders nodes cleanly on `#050508` dark canvas, with convex knowledge clusters, without decorative planetary rings or atmospheric halos, and with explicit visual explainability (SPACE-01, SPACE-02)
Proof: run frontend | ok 17 - SPACE-01/02: clean 3D knowledge graph renders on #050508 canvas with convex knowledge clusters and zero planetary rings/halos

**C18** - Genre graph exploration guarantees cohesion by automatically switching to `bipartite` mode when filtering by `genre`, generating projected `genre-genre` weighted edges in `filterSpaceGraph`, and preserving full bipartite neighborhood in the analytical inspector (SPACE-01, SPACE-06, SPACE-07)
Proof: run frontend | ok 18 - SPACE-01/06/07: genre graph auto-switches to bipartite, projects genre-genre edges, and preserves full neighborhood in inspector

**C19** - Hover camera zoom stability ensures node hover does not trigger `zoomToFit` or camera matrix reset, with `hasInitialFitRef` preventing re-fitting on subsequent `onEngineStop` triggers and stable callback refs preventing component remounts (SPACE-03, SPACE-04)
Proof: run frontend | ok 19 - SPACE-03/04: hover over 3D node maintains camera zoom and position without triggering zoomToFit or matrix reset

---

## Handoff

**Settled mid-build:** User conceptually approved Gate 1 (Figma 20-Reference Visual Research) and requested 6 targeted revisions to Gates 2 & 3 (deterministic mathematical formulas & fallbacks, specialist task alignment for `T1`/`T5`/`T6`/`T8`, live backend verification of `connected_artists_count` & provenance, and expanded proofs `C9`–`C14`) before granting formal approval to start Execute.
**Dispatched:** Phase 1 discovery & Figma research completed by all 7 Maestri specialists; Gates 2 & 3 updated with all 6 requested revisions.
**Walked:** pending Execute phase

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: `frontend/lib/spaceGraphModel.js` | 1 module | ✅ Granular |
| T2: `frontend/lib/spacePreferences.js` | 1 module | ✅ Granular |
| T3: `backend/tests/test_api.py` (+ `backend/main.py` & `openspec/openapi.yaml` contract) | 1 contract slice | ✅ Granular |
| T4: `frontend/app/globals.css` | 1 stylesheet | ✅ Granular |
| T5: `frontend/package.json` (+ `frontend/package-lock.json`) | 1 dependency manifest slice | ✅ Granular |
| T6: `frontend/components/space/PlanetaryRenderer.js` | 1 module | ✅ Granular |
| T7: `frontend/components/space/SpaceHudControls.jsx` | 1 component | ✅ Granular |
| T8: `frontend/components/space/SpaceInspectorPanel.jsx` | 1 component | ✅ Granular |
| T9: `frontend/components/SpotifyConstellationGraph.jsx` | 1 component | ✅ Granular |
| T10: `frontend/tests/spaceGraphModel.test.mjs` | 1 test suite | ✅ Granular |
| T11: `frontend/components/space/PlanetaryRenderer.js` (+ `frontend/app/globals.css`) | 1 visual component slice | ✅ Granular |
| T12: `frontend/lib/spaceGraphModel.js` | 1 domain math slice | ✅ Granular |
| T13: `frontend/lib/spaceGraphModel.js` (+ `SpaceHudControls.jsx` & `SpaceInspectorPanel.jsx`) | 1 genre feature slice | ✅ Granular |
| T14: `frontend/components/SpotifyConstellationGraph.jsx` | 1 camera stability slice | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | root node | ✅ Match |
| T2 | None | root node | ✅ Match |
| T3 | None | root node | ✅ Match |
| T4 | None | root node | ✅ Match |
| T5 | None | root node | ✅ Match |
| T6 | T1, T5 | T1 -> T6, T5 -> T6 | ✅ Match |
| T7 | T1, T4 | T1 -> T7, T4 -> T7 | ✅ Match |
| T8 | T1, T4 | T1 -> T8, T4 -> T8 | ✅ Match |
| T9 | T2, T3, T6, T7, T8 | T2 -> T9, T3 -> T9, T6 -> T9, T7 -> T9, T8 -> T9 | ✅ Match |
| T10 | T1, T2, T6, T9 | T1 -> T10, T2 -> T10, T6 -> T10, T9 -> T10 | ✅ Match |
| T11 | T6, T9 | T6 -> T11, T9 -> T11 | ✅ Match |
| T12 | T1 | T1 -> T12 | ✅ Match |
| T13 | T1, T7, T8, T9 | T1 -> T13, T7 -> T13, T8 -> T13, T9 -> T13 | ✅ Match |
| T14 | T9 | T9 -> T14 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Spatial Domain, Math & Explainability | unit | unit | ✅ OK |
| T2 | Client Persistence | unit | unit | ✅ OK |
| T3 | Backend Graph & OAuth API | integration | integration | ✅ OK |
| T4 | 3D/2D UI, WebGL Renderer & Camera/Inspector Integration | integration | integration | ✅ OK |
| T5 | 3D/2D UI, WebGL Renderer & Camera/Inspector Integration | integration | integration | ✅ OK |
| T6 | 3D/2D UI, WebGL Renderer & Camera/Inspector Integration | integration | integration | ✅ OK |
| T7 | 3D/2D UI, WebGL Renderer & Camera/Inspector Integration | integration | integration | ✅ OK |
| T8 | 3D/2D UI, WebGL Renderer & Camera/Inspector Integration | integration | integration | ✅ OK |
| T9 | 3D/2D UI, WebGL Renderer & Camera/Inspector Integration | integration | integration | ✅ OK |
| T10 | 3D/2D UI, WebGL Renderer & Camera/Inspector Integration | integration | integration | ✅ OK |
| T11 | 3D/2D UI, WebGL Renderer & Camera/Inspector Integration | integration | integration | ✅ OK |
| T12 | Spatial Domain, Math & Explainability | unit | unit | ✅ OK |
| T13 | 3D/2D UI, WebGL Renderer & Camera/Inspector Integration | integration | integration | ✅ OK |
| T14 | 3D/2D UI, WebGL Renderer & Camera/Inspector Integration | integration | integration | ✅ OK |
