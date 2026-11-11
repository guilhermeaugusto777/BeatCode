# STATE

## Decisions

### AD-001
- **Decision**: Maintain Next.js 16 (`frontend/`) as the unified primary UI consuming the FastAPI contract (`/api/graph`, `/auth/*`) with isolated per-browser OAuth sessions (`beatcode_session` cookie) and public demo mode (`demo=true`).
- **Reason**: Prevents split maintenance between FastAPI's legacy HTML canvas and Next.js while preserving OAuth security and zero-credential demo exploration.
- **Trade-off**: Requires client-only dynamic rendering (`ssr: false`) for WebGL/Three.js and Canvas 2D components in Next.js App Router.
- **Scope**: `frontend/`, `backend/main.py`, `openspec/`
- **Date**: 2026-11-11
- **Status**: active

### AD-002
- **Decision**: Separate pure, deterministic graph-space transformation, filtering, search, and neighborhood traversal logic (`frontend/lib/spaceGraphModel.js`) from WebGL/Canvas presentation (`frontend/components/`).
- **Reason**: Enforces TLC Spec-Driven rule #6 ("Every rule that changes what a user sees — including filtering, searching, sorting and counting — runs in a layer the repo's tests reach") and keeps 3D planet rendering decoupled from domain calculations.
- **Trade-off**: Adds a dedicated data-transformation module between the `/api/graph` response and `ForceGraph3D`/`ForceGraph2D`.
- **Scope**: `frontend/lib/`, `frontend/components/`, `frontend/tests/`
- **Date**: 2026-11-11
- **Status**: active

### AD-003
- **Decision**: Define pure modular boundaries for 3D layout, planetary Three.js rendering, camera navigation, interaction/raycasting, and contextual HUD.
- **Reason**: Decouples UI framework concerns, avoids massive 600+ line monoliths, and allows unit testing of graph math without WebGL context.
- **Trade-off**: Requires clear JSDoc interface contracts between the architectural layers.
- **Scope**: `frontend/lib/spaceGraphModel.js`, `frontend/components/space/`
- **Date**: 2026-11-11
- **Status**: active

### AD-004
- **Decision**: Implement seamless 2D Canvas / 3D Space toggle with bidirectional state synchronization and automatic fallback/recovery on `webglcontextlost`, `webglcontextrestored`, or `prefers-reduced-motion`.
- **Reason**: Guarantees accessibility (WCAG 2.1 AA) and hardware tolerance on mobile or low-power GPUs without state loss.
- **Trade-off**: Requires maintaining both 2D and 3D rendering adapters against the same underlying data model.
- **Scope**: `frontend/components/SpotifyConstellationGraph.jsx`, `frontend/components/space/PlanetaryRenderer.js`
- **Date**: 2026-11-11
- **Status**: active

### AD-005
- **Decision**: Enforce explicit GPU memory disposal (`disposeThreeUniverse`) covering geometries, materials, textures, and canvas sprites upon component unmount or mode toggle.
- **Reason**: Prevents cumulative VRAM memory leaks and WebGL context crashes in single-page navigation.
- **Trade-off**: Requires manual tracking of all Three.js disposable instances in a `resourceRegistry`.
- **Scope**: `frontend/components/space/PlanetaryRenderer.js`
- **Date**: 2026-11-11
- **Status**: active

### AD-006
- **Decision**: Surface deterministic 4-attribute edge weight decomposition (`0.65g + 0.25c + 0.10t` + qualitative `shared_genres` classification) and 2-hop harmonic relevance ($A_{2\text{hop}}(u, z) = 1 - \prod_m (1 - 0.70 W_{um} W_{mz})$) with strict provenance badges (`[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]`).
- **Reason**: Enhances explainability of the network, converting abstract similarity into transparent musical evidence without fabricating metrics.
- **Trade-off**: Requires `spaceGraphModel.js` and `SpaceInspectorPanel.jsx` to parse and classify all 4 connection attributes and provenance tags.
- **Scope**: `frontend/lib/spaceGraphModel.js`, `frontend/components/space/SpaceInspectorPanel.jsx`
- **Date**: 2026-11-11
- **Status**: active

### AD-007
- **Decision**: Align `T1`–`T10` specialist ownership strictly with configured Maestri functions (`Engenheiro de IA e Agentes` on `T1`; `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade` on `T4, T6, T7, T8, T9`; `Desenvolvedor Back-end + APIs e Integrações` on `T3, T5`; `Engenheiro de Banco de Dados local` on `T2`; `QA` on `T10`; `Revisor de Código + Segurança + DevOps` as independent Verifier), normalize `connected_artists_count` on all `GraphNode` items in `backend/main.py` with integration test proof `C14`, and expand proofs to `C1`–`C14`.
- **Reason**: Honors user gate review feedback before starting the Execute phase while preserving wave parallelism and zero file contention.
- **Trade-off**: `UI/UX Designer + Desenvolvedor Front-end + Acessibilidade` owns the 3D/React modules (`T6, T7, T8`) in Wave 2 after completing `T4` in Wave 1.
- **Scope**: `.specs/features/beatcode-space/{spec.md,design.md,tasks.md}`
- **Date**: 2026-11-11
- **Status**: active

### AD-008
- **Decision**: Upgrade `three` to `^0.180.0` in `frontend/package.json` to satisfy `three-render-objects@1.44.1` (`peerDependencies: { "three": ">=0.179" }`), add the WCAG 2.2 AA accessible textual catalog (`[data-testid="accessible-planet-list"]`) inside `SpaceInspectorPanel.jsx`, and automate live browser E2E verification (`C15`) in `frontend/tests/e2eSpaceBrowser.mjs`.
- **Reason**: Ensures Next.js 16 Turbopack production builds resolve `three/webgpu` and `Timer` cleanly, guarantees non-3D keyboard/screen-reader access to every node, and provides reproducible live-browser E2E proof.
- **Trade-off**: Requires running local backend (`:8000`) and frontend (`:3000`) with the Maestri Browser Portal during `npm --prefix frontend run test:e2e`.
- **Scope**: `frontend/package.json`, `frontend/components/space/SpaceInspectorPanel.jsx`, `frontend/tests/e2eSpaceBrowser.mjs`
- **Date**: 2026-11-11
- **Status**: active

### AD-009
- **Decision**: Replace speculative cosmic/planetary metaphor (atmospheres, Saturn rings, starfield) with an authoritative 3D Knowledge Graph inspired by Graphify (clean avatar spheres, faceted genre hubs, Louvain knowledge clusters, `#050508` dark canvas) and enforce strictly linear listening sizing ($D_i = D_{\max} \cdot (L_i / L_{\max})$, $R_i = D_i / 2$) with separate scales for artists ($D_{\max}=28.0, R_{\max}=14.0$) and genres ($D_{\max}=24.0, R_{\max}=12.0$), deduplicated genre listening aggregation ($L_g$), and safe geometric fallback ($R_{\min,\text{safe}}=2.0, \text{isFallbackListening}=\text{true}$) for $L_i \le 0$ or `NaN`.
- **Reason**: Eliminates visual distraction and cognitive clutter, guarantees visual volume mathematically reflects listening volume ($1000$ vs $500 \implies 2.0\times$, $1000$ vs $750 \implies 1.3333\times$, $1500$ vs $1000 \implies 1.5\times$), and prevents multi-artist collaboration distortion in genres.
- **Trade-off**: Requires updating node sizing math in `frontend/lib/spaceGraphModel.js` and visual styling in `PlanetaryRenderer.js` and `globals.css`.
- **Scope**: `frontend/lib/spaceGraphModel.js`, `frontend/components/space/PlanetaryRenderer.js`, `frontend/app/globals.css`, `.specs/features/beatcode-space/`
- **Date**: 2026-11-11
- **Status**: active

### AD-010
- **Decision**: Fix genre graph cohesion by automatically switching to `bipartite` mode when filtering by `genre`, generating projected `genre-genre` weighted edges ($W(g_1, g_2) = \frac{|A(g_1) \cap A(g_2)|}{|A(g_1) \cup A(g_2)|}$) in `filterSpaceGraph`, and preserving full bipartite neighborhood in the analytical inspector. Eliminate the hover camera zoom loss bug using `hasInitialFitRef` to restrict `zoomToFit` to initial stabilization and wrapping hover callbacks in stable references.
- **Reason**: Solves empty/broken genre subgraphs, guarantees complete neighborhood navigation in the inspector, and fixes intrusive camera resets when hovering over 3D nodes.
- **Trade-off**: Adds projected edge generation to `filterSpaceGraph` and requires managing ref stability for `<ForceGraph3D>` interaction props.
- **Scope**: `frontend/lib/spaceGraphModel.js`, `frontend/components/SpotifyConstellationGraph.jsx`, `frontend/components/space/SpaceInspectorPanel.jsx`
- **Date**: 2026-11-11
- **Status**: active

### AD-011
- **Decision**: Establish strict tripartite isolation of Spotify data sources: A. Reprodução Observada (`observed_plays` from timestamped history), B. Afinidade Spotify (`affinity_rank`, `affinity_score`, `top_tracks_count`), and C. Biblioteca Salva (`saved_tracks_count`). In the absence of absolute historical play counts, enforce the Zero Fictitious Counts invariant by cleanly transitioning $L_i$ to an `estimated_listening_index` with transparent methodology (composite of affinity score and top-tracks presence across the selected horizon) and period, NEVER presented as raw play counts. Enforce genre listening deduplication on the unique key `(track_id, genre)`.
- **Reason**: Upholds project core truth and AI governance rules, prevents the fabrication of synthetic stream counts, eliminates duplicate counting of multi-artist collaborations within the same genre, and preserves strict empirical provenance.
- **Trade-off**: Requires explicit typing, distinct metadata tags, and UI badge rendering in `spaceGraphModel.js` and `SpaceInspectorPanel.jsx`.
- **Scope**: `frontend/lib/spaceGraphModel.js`, `frontend/components/space/SpaceInspectorPanel.jsx`, `.specs/features/beatcode-space/`
- **Date**: 2026-11-11
- **Status**: active

## Handoff

- **Feature**: `beatcode-space` (`.specs/features/beatcode-space`)
- **Phase / Task**: Wave 5 Planning — Tasks `T15`–`T18` & Proofs `C20`–`C22` Documented for Tripartite Spotify Sources & Non-Fictitious Metrics
- **Completed**: TLC Spec-Driven documentation updated (`spec.md`, `design.md`, `tasks.md`, `STATE.md`) with tripartite Spotify data source separation (observed plays vs affinity vs saved tracks), Zero Fictitious Counts invariant, `estimated_listening_index` fallback, `(track_id, genre)` deduplication, tasks T15–T18, and proofs C20–C22.
- **In-progress** (file:line): `.specs/features/beatcode-space/tasks.md:430` — Ready for Wave 5 execution upon user authorization.
- **Next step**: Execute Wave 5 tasks T15–T18 according to specialist assignments.
- **Blockers**: none
- **Uncommitted files**: `AGENTS.md`, `.agents/`, `graphify-out/`
- **Branch**: `main`
