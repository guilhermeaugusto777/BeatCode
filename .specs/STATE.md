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

## Handoff

- **Feature**: `beatcode-space` (`.specs/features/beatcode-space`)
- **Phase / Task**: Validate Phase — All Tasks `T1`–`T10` & Proofs `C1`–`C15` Complete & Verified
- **Completed**: All 10 tasks (`T1`–`T10`), live browser E2E suite (`C15`), and TLC specification/design/validation artifacts completed, tested, and atomically committed.
- **In-progress** (file:line): none
- **Next step**: Feature complete and ready for user review.
- **Blockers**: none
- **Uncommitted files**: `AGENTS.md`, `.agents/`, `graphify-out/`
- **Branch**: `main`
