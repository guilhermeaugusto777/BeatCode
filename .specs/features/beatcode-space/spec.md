# BeatCode Space — 3D Spatial Graph Universe Specification

## Problem Statement

BeatCode currently renders the user's Spotify musical graph in `frontend/components/SpotifyConstellationGraph.jsx` exclusively as a flat 2D canvas without a 3D spatial exploration mode, without visual differentiation of planetary bodies, atmospheres, and star-system constellations, without edge weight decomposition (`components`) or 2-hop indirect connection navigation in the inspector, and without cluster visibility controls or a decoupled, unit-testable spatial graph model. Users need an immersive, performant, and accessible 3D space universe experience (**BeatCode Space**) that turns real graph topology into planets, star systems, and luminous trajectories while preserving the 2D fallback and all existing backend contracts.

## Goals

- [x] Transform the graph visualization into an interactive 3D space universe (`BeatCode Space`) where artists are rendered as planets with deterministic radii, procedural/photo textures, atmospheric halos, and orbital rings, genres (in `bipartite` mode) are rendered as emissive stellar cores, clusters act as star systems/constellations, and edges act as luminous trajectories.
- [x] Enforce deterministic mathematical formulas with explicit normalization rules and safe fallback defaults for planet radii, atmospheric halo intensity, 3D Fibonacci cluster centroids, 2-hop multi-path relevance, and the 4-attribute connection composition (`0.65g + 0.25c + 0.10t` + qualitative `shared_genres`).
- [x] Provide smooth 360° camera navigation, zoom, pan, planet focus, star-system cluster centering, one-click return to the full universe overview, contextual planet inspection with explicit provenance badges (`[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]`), and 3D ↔ 2D toggle with WebGL context-loss recovery, GPU resource disposal, and `prefers-reduced-motion` compliance.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Multi-user cloud database or persistent server-side token storage | In-memory browser-isolated OAuth sessions (`beatcode_session`) remain the architecture standard for local execution |
| Audio playback streaming or Spotify Web Playback SDK integration | Scope is strictly graph visualization, topological exploration, and UI/UX evolution |
| Probabilistic LLM generation inside graph layout or edge weight calculation | All topological, mathematical, and visual mapping rules are strictly deterministic per AI governance rules |

---

## Deterministic Mathematical Specification & Normalization Rules

Implementers MUST NOT invent or alter formulas during execution. Every visual and topological calculation is governed by the deterministic equations and fallback rules below:

### 1. Input Sanitization & Default Fallbacks for Missing or Invalid Attributes

For any node $u$, link $e = (u, v)$, or `metadata` object with missing (`undefined`, `null`), `NaN`, infinite, or out-of-range fields:

- **Affinity Score ($S_{\text{aff}}(u)$):** If `u.affinity_score` is finite, clamp to $[0.25, 1.00]$; otherwise default to $0.50$. Normalized affinity:
  $$\hat{S}_{\text{aff}}(u) = \text{clamp}\left(\frac{S_{\text{aff}}(u) - 0.25}{0.75}, \ 0.0, \ 1.0\right)$$
- **Global Popularity ($P_{\text{glob}}(u)$):** If `u.global_popularity` is finite, clamp to $[0, 100]$; otherwise default to $50$. Normalized popularity:
  $$\hat{P}_{\text{glob}}(u) = \frac{P_{\text{glob}}(u)}{100.0} \in [0.0, 1.0]$$
- **Centralities ($C_D(u), C_B(u)$):** If `u.metrics?.degree_centrality` (resp. `betweenness_centrality`) is finite, clamp to $[0.0, 1.0]$; otherwise default to $0.0$.
- **Connected Artists Count ($k_g$ for genre nodes):** If `u.connected_artists_count` is finite and $\ge 1$, clamp to $[1, 50]$; otherwise infer from incident edges in `links` (minimum $1$). On artist nodes (`node_type === "artist"`), `connected_artists_count` is explicitly `null`.
- **Node Color & Name:** If `u.color` is missing or not a valid hex color, default to `#1DB954`. If `u.name` is missing or empty, default to `"Desconhecido"`.

### 2. Planetary Radius ($R_{\text{planet}}$) & Genre Stellar Core Radius ($R_{\text{star}}$)

- **Normalized Composite Mass Index ($M(u) \in [0.0, 1.0]$):**
  $$M(u) = 0.55 \cdot \hat{S}_{\text{aff}}(u) + 0.30 \cdot \hat{P}_{\text{glob}}(u) + 0.15 \cdot C_D(u)$$
- **Unipartite Mode (`graph_mode === "artists"`, `node_type === "artist"`):**
  $$R_{\text{planet}}(u) = \text{round}\left(3.5 + 10.5 \cdot M(u), \ 2\right) \in [3.50, 14.00]$$
- **Bipartite Mode (`graph_mode === "bipartite"`):**
  - Artist Planet (`node_type === "artist"`):
    $$R_{\text{planet}}(u) = \text{round}\left(3.0 + 9.0 \cdot M(u), \ 2\right) \in [3.00, 12.00]$$
  - Genre Stellar Core (`node_type === "genre"`):
    $$R_{\text{star}}(g) = \text{round}\left(5.0 + 10.0 \cdot \min\left(1.0, \ \frac{k_g}{12.0}\right), \ 2\right) \in [5.83, 15.00]$$

### 3. Atmospheric Halo Intensity ($\Phi(u), R_{\text{halo}}, \alpha_{\text{halo}}$) & Orbital Rings

- **Cultural Radiation Index ($\Phi(u) \in [0.0, 1.0]$):**
  $$\Phi(u) = \text{clamp}\left(0.70 \cdot \sqrt{C_B(u)} + 0.30 \cdot C_D(u), \ 0.0, \ 1.0\right)$$
- **Halo Outer Radius ($R_{\text{halo}}(u)$):**
  $$R_{\text{halo}}(u) = \text{round}\left(R_{\text{base}}(u) \cdot (1.15 + 1.25 \cdot \Phi(u)), \ 2\right) \in [1.15 R_{\text{base}}, \ 2.40 R_{\text{base}}]$$
  where $R_{\text{base}}(u)$ is $R_{\text{planet}}(u)$ or $R_{\text{star}}(u)$.
- **Halo Opacity ($\alpha_{\text{halo}}(u)$):**
  $$\alpha_{\text{halo}}(u) = \text{round}\left(0.10 + 0.55 \cdot (\Phi(u))^{0.80}, \ 3\right) \in [0.100, 0.650]$$
- **Inter-Cluster Diversity & Orbital Ring Eligibility:**
  $$\text{Div}_{\text{cluster}}(u) = \frac{|\{(u, v) \in E \mid c(u) \neq c(v)\}|}{\max(\deg(u), 1)} \in [0.0, 1.0]$$
  A node receives an orbital ring (`hasOrbitalRing = true`) if and only if $u.\text{id} === \text{metadata?.bridge\_artist?.id} \ \lor \ \text{Div}_{\text{cluster}}(u) \ge 0.30$, with inner radius $R_{\text{ring\_in}} = \text{round}(1.35 \cdot R_{\text{base}}(u), 2)$ and outer radius $R_{\text{ring\_out}} = \text{round}(2.05 \cdot R_{\text{base}}(u), 2)$.

### 4. 3D Star-System Cluster Centroids ($\mathbf{C}_k$)

- Given $K = \max(\text{clusters.length}, 1)$ and Louvain modularity $Q = \text{clamp}(\text{Number.isFinite}(\text{metadata?.modularity\_score}) \ ? \ \text{metadata.modularity\_score} : 0.0, \ -0.5, \ 1.0)$:
  $$R_{\text{galaxy}} = 220.0 \cdot \left(1.0 + 1.8 \cdot \max(0.0, Q)\right) \in [220.0, 616.0]$$
- With Golden Angle $\varphi = \pi \cdot (3 - \sqrt{5}) \approx 2.39996323 \text{ rad}$, for cluster index $k \in \{0, \dots, K-1\}$:
  - If $K === 1$: $\mathbf{C}_0 = (0.0, 0.0, 0.0)$.
  - If $K > 1$:
    $$z_k = 1.0 - \frac{2k + 1}{K}, \quad \rho_k = \sqrt{\max(0.0, 1.0 - z_k^2)}, \quad \theta_k = k \cdot \varphi$$
    $$\mathbf{C}_k = \left(\text{round}(R_{\text{galaxy}} \rho_k \cos\theta_k, 2), \ \text{round}(R_{\text{galaxy}} \rho_k \sin\theta_k, 2), \ \text{round}(R_{\text{galaxy}} z_k, 2)\right)$$

### 5. Edge Weight Composition (`0.65g + 0.25c + 0.10t`) & Role of the Four Connection Attributes

Each unipartite link (`link_type === "artist-artist"`) carries four connection attributes that participate in the weight and explainability model as follows:

1. **`genre_similarity` ($g \in [0.0, 1.0]$, from `link.components.genre_similarity`):** Cosine similarity over TF-IDF vectors of normalized genre and sub-genre tokens (weight $\alpha = 0.65$). Weighted numeric contribution:
   $$C_g = \text{round}(0.65 \cdot \text{clamp}(g, 0.0, 1.0), \ 4) \in [0.0, 0.65]$$
2. **`direct_collaboration` ($c \in [0.0, 1.0]$, from `link.components.direct_collaboration`):** Direct co-authorship on tracks in the user's top/saved tracks (weight $\beta = 0.25$). Weighted numeric contribution:
   $$C_c = \text{round}(0.25 \cdot \text{clamp}(c, 0.0, 1.0), \ 4) \in [0.0, 0.25]$$
3. **`co_listening` ($t \in [0.0, 1.0]$, from `link.components.co_listening`):** Sequential proximity in recent listening sessions (weight $\gamma = 0.10$). Weighted numeric contribution:
   $$C_t = \text{round}(0.10 \cdot \text{clamp}(t, 0.0, 1.0), \ 4) \in [0.0, 0.10]$$
4. **`shared_genres` ($G_{\text{shared}} = u.\text{genres} \cap v.\text{genres}$, from `link.shared_genres: string[]`):** Qualitative evidence attribute for $C_g$. Because $\alpha + \beta + \gamma = 0.65 + 0.25 + 0.10 = 1.00$, `shared_genres` does NOT add a 4th numeric term to $W(u, v)$; instead, it qualifies the nature of the $0.65g$ genre similarity:
   - When `shared_genres.length > 0` and $g > 0$: classifies the genre component as `"exact_and_subtoken_match"` and displays the exact shared genre labels.
   - When `shared_genres.length === 0` and $g > 0$: classifies the genre component as `"subtoken_lexical_match"` (indicating TF-IDF sub-token overlap such as `"indie rock"` $\leftrightarrow$ `"modern rock"` without an identical full label).
   - When $g === 0$: classifies the genre component as `"none"`.
- **Composite Weight Formula & Missing-Attribute Fallback:**
  $$W_{\text{calc}}(u, v) = \text{round}\left(\text{clamp}(C_g + C_c + C_t, \ 0.0, \ 1.0), \ 4\right)$$
  If `link.components` is missing or invalid on an `artist-artist` link, $g, c, t$ default to $0.0$, `shared_genres` defaults to `[]`, and `link.weight` is clamped to $[0.0, 1.0]$ (default $0.12$). In `bipartite` mode (`link_type === "artist-genre"`), `link.components` is `null` and $W(a, g) = \text{round}(0.35 + 0.65 \cdot S_{\text{aff}}(a), 3)$.

### 6. 2-Hop Indirect Connection Relevance ($A_{2\text{hop}}(u, z)$)

- Given filtered graph $G = (V, E)$, direct 1-hop neighbors of $u$ are $N_1(u) = \{m \in V \mid (u, m) \in E\}$, ordered descending by $W(u, m)$ then ascending by $m.\text{name}$.
- Candidate 2-hop nodes are $N_2(u) = \{z \in V \setminus (\{u\} \cup N_1(u)) \mid M(u, z) \neq \emptyset\}$, where $M(u, z) = \{m \in N_1(u) \mid (m, z) \in E\}$ is the set of intermediate bridge nodes.
- **Multi-Path Harmonic Relevance Score ($A_{2\text{hop}}(u, z) \in (0.0, 1.0]$):** With hop attenuation factor $\lambda = 0.70$:
  $$A_{2\text{hop}}(u, z) = \text{round}\left(1.0 - \prod_{m \in M(u, z)} \left(1.0 - 0.70 \cdot W(u, m) \cdot W(m, z)\right), \ 4\right)$$
- **Deterministic Ordering:** Sorted descending by $A_{2\text{hop}}(u, z)$, then descending by bridge count $|M(u, z)|$, then ascending by $z.\text{name}$, capped at top $8$ indirect connections.

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| 3D rendering engine on Next.js 16 / React 19 | `react-force-graph-3d` + `three` loaded via `next/dynamic` (`ssr: false`) and locked in `package.json` + `package-lock.json` | Integrates directly with the existing force-graph data model and supports custom Three.js planet meshes, atmospheres, starfields, and camera interpolation | y |
| Pure domain model separation | Extract all deterministic planet sizing, cluster centroids, filtering, search, 1-hop/2-hop neighbor ranking, and `0.65g + 0.25c + 0.10t` decomposition into `frontend/lib/spaceGraphModel.js` | Enforces TLC rule #6 so every mathematical formula, filter, search, and count is verified by automated tests (`node --test`) | y |
| Backend contract for `connected_artists_count` & data provenance | Ensure `backend/main.py` returns `connected_artists_count` on every `GraphNode` (`int >= 1` for `genre` nodes, `null` for `artist` nodes), document in `openspec/openapi.yaml`, and verify with FastAPI integration tests in `backend/tests/test_api.py` | Verifies the live backend service delivery rather than relying on OpenAPI documentation alone | y |
| Client preference persistence | Store non-sensitive UI preferences (`view_mode`, `min_edge_weight`, `hidden_clusters`, `visible_node_types`, `visual_effects`, `recent_planets`) under `localStorage` key `beatcode_space_prefs_v1` with defensive fallback | Preserves user exploration preferences across reloads while upholding the zero-secret invariant | y |
| Input validation & bounds | Clamp `min_edge_weight` to `[0.05, 0.65]`, sanitize all tooltip HTML via `escapeHtml()`, cap search queries at 80 characters, and apply deterministic defaults for missing/NaN node or link fields | Prevents XSS (CWE-79), `NaN` geometry corruption in Three.js, and out-of-range filter states | y |
| Failure / partial-failure states & External-dependency failure | Detect missing WebGL support or `webglcontextlost` / `webglcontextrestored` events to automatically fall back to 2D Canvas mode and recover cleanly; fallback to procedural planet surface when Spotify CDN image fails or blocks CORS | Guarantees uninterrupted exploration on restricted GPUs or offline/demo environments | y |
| Idempotency / retry / duplicate handling | Cancel in-flight `/api/graph` requests on parameter change and reuse flyweight Three.js geometries/textures with deterministic disposal (`disposeThreeUniverse`) | Prevents duplicate meshes, race conditions on rapid filter toggles, and GPU VRAM leaks | y |
| Auth boundaries & rate limits | Preserve `credentials: "include"` and `cache: "no-store"` on `/auth/*` and `/api/graph`, and surface HTTP `429` `Retry-After` hints in the error state | Maintains existing browser-isolated OAuth security and rate-limit clarity | y |
| Concurrency / ordering & State-transition integrity | Guard view transitions (`welcome` → `checking` → `demo`/`spotify` and `3D` ↔ `2D`) so switching between 2D and 3D retains `selectedNode`, `timeRange`, `graphMode`, `minEdgeWeight`, and `hiddenClusters` | Ensures state continuity during exploration | y |
| Data lifecycle / expiry & Observability | Cap `recent_planets` history at 10 items in client storage and expose live topological telemetry with explicit provenance badges (`[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]`) in the HUD | Keeps local storage bounded (<2 KB) and maintains strict transparency between measured data and inferences | y |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: 3D Cosmic Universe & Planetary Graph Representation ⭐ MVP

**User Story**: As a music explorer, I want my Spotify artist and genre graphs rendered as a 3D space universe with planets, atmospheric halos, orbital rings, star systems, and luminous trajectories governed by deterministic formulas so that I can visually perceive musical affinities, communities, and bridge artists.

**Why P1**: Core visual and mathematical foundation of BeatCode Space.

**Acceptance Criteria**:

1. WHEN the graph loads in 3D mode with `graph_mode="artists"` THEN the system SHALL render each artist node as a 3D planet with deterministic radius $R_{\text{planet}}(u) = \text{round}(3.5 + 10.5 \cdot M(u), 2) \in [3.50, 14.00]$, atmospheric halo radius $R_{\text{halo}}(u) = \text{round}(R_{\text{planet}}(u) \cdot (1.15 + 1.25 \cdot \Phi(u)), 2)$, halo opacity $\alpha_{\text{halo}}(u) = \text{round}(0.10 + 0.55 \cdot \Phi(u)^{0.80}, 3)$, and an orbital ring when $u$ is `bridge_artist` or $\text{Div}_{\text{cluster}}(u) \ge 0.30$.
2. WHEN the graph loads in 3D mode with `graph_mode="bipartite"` THEN the system SHALL render artist nodes as 3D planets ($R_{\text{planet}} \in [3.00, 12.00]$ with `connected_artists_count: null`) and genre nodes (`node_type="genre"`) as emissive polyhedral stellar cores with radius $R_{\text{star}}(g) = \text{round}(5.0 + 10.0 \cdot \min(1.0, k_g / 12.0), 2) \in [5.83, 15.00]$ derived from the backend's `connected_artists_count` ($k_g$).
3. WHEN the 3D scene initializes THEN the system SHALL position community cluster centroids (`metadata.clusters`) on a 3D Fibonacci sphere of radius $R_{\text{galaxy}} = 220 \cdot (1 + 1.8 \cdot \max(0, Q))$ and render a background cosmic starfield with luminous edge trajectories whose width and opacity reflect `link.weight`.
4. IF any node or link has missing, `null`, or non-finite numeric attributes OR an artist `image_url` fails to load THEN the system SHALL apply the deterministic fallback defaults and render a procedural planetary surface colored by `node.color` without `NaN` coordinates or unhandled WebGL/CORS errors.

**Independent Test**: Load demo mode (`demo=true`) in 3D for both `artists` and `bipartite` modes and verify planetary radii, halos, orbital rings, genre stellar cores, `connected_artists_count`, starfield, and cluster centroids.

---

### P1: 360° Spatial Camera Navigation & Constellation Focus ⭐ MVP

**User Story**: As a user exploring the 3D universe, I want smooth 360° camera rotation, zoom, pan, planet centering, star-system focus, and a reset-to-universe button so that I can navigate between macro constellations and individual planets comfortably.

**Why P1**: Essential for 3D spatial usability and preventing disorientation.

**Acceptance Criteria**:

1. WHILE the 3D universe view is active the system SHALL support 360° orbital rotation, 3D panning, and bounded zoom (`minDistance >= 25`, `maxDistance <= 1600`) with smooth damping.
2. WHEN the user clicks a planet node or selects it from the search/inspector panel THEN the system SHALL smoothly transition the camera to focus on that planet's 3D coordinates and update the exploration depth indicator to `"Órbita Planetária"`.
3. WHEN the user selects a star system (`cluster`) in the HUD THEN the system SHALL center the camera on that cluster's 3D Fibonacci centroid and update the exploration depth indicator to `"Sistema Estelar"`.
4. WHEN the user activates the `"Visão Geral do Universo"` (`Enquadrar`) control THEN the system SHALL smoothly fit the entire visible graph into the viewport and set the exploration depth indicator to `"Universo"`.

**Independent Test**: Rotate, zoom, focus a planet, focus a cluster constellation, and click `"Visão Geral do Universo"` to verify smooth camera transitions and depth indicator updates.

---

### P1: Planetary Interactivity, Data Provenance & 4-Attribute Edge Decomposition ⭐ MVP

**User Story**: As a user inspecting my musical universe, I want hover highlights and a contextual planet panel distinguishing real Spotify data from BeatCode inferences, explaining all four connection attributes (`0.65g + 0.25c + 0.10t` + `shared_genres`), and providing navigable 1-hop and 2-hop planetary connections.

**Why P1**: Connects the 3D visual metaphor to verifiable data and mathematical transparency.

**Acceptance Criteria**:

1. WHEN the user hovers over a planet or stellar core THEN the system SHALL highlight the hovered node and its incident trajectories, attenuate non-incident elements, and display a sanitized tooltip (`escapeHtml`) with the node's name, type, and primary metric.
2. WHEN a planet or genre hub is selected THEN the system SHALL display in the contextual sidebar its attributes explicitly tagged with `[DADO SPOTIFY]` (`name`, `affinity_rank`, `global_popularity`, `genres`, `top_tracks`) versus `[INFERÊNCIA BEATCODE]` (`affinity_score`, `degree_centrality`, `betweenness_centrality`, `cluster_id`, `connected_artists_count`).
3. WHEN a planet is selected in `artists` mode THEN the system SHALL list its direct 1-hop connections ordered by `link.weight` showing the exact weighted contributions $C_g = 0.65g$, $C_c = 0.25c$, $C_t = 0.10t$ alongside the qualitative `shared_genres` classification (`"exact_and_subtoken_match"` vs `"subtoken_lexical_match"`), plus the top 8 indirect 2-hop connections ranked by $A_{2\text{hop}}(u, z) = 1 - \prod_m (1 - 0.70 W_{um} W_{mz})$, allowing click-to-navigate on any related planet.
4. WHEN the user clicks the background space or the close button on the inspector THEN the system SHALL clear `selectedNode` and restore full-universe trajectory visibility while preserving the current camera position.

**Independent Test**: Select an artist in demo mode, verify `[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]` badges, verify `0.65g + 0.25c + 0.10t` and `shared_genres` breakdown, and click a 1-hop and a 2-hop neighbor to navigate across planets.

---

### P2: Spatial HUD, Search, Category/Cluster Filters & Cosmic Legend

**User Story**: As a user analyzing complex graphs, I want a compact spatial navigation bar, real-time search (`/`), category and constellation visibility filters, edge weight threshold control, and a visual legend so that I can filter noise and locate specific planets or genres immediately.

**Why P2**: Elevates usability, visual hierarchy, and analytical control across dense graphs.

**Acceptance Criteria**:

1. WHEN the user types in the search input (or presses `/`) or selects a node-type filter (`all`, `artist`, `genre`) THEN the system SHALL filter matching nodes deterministically by name or genre and allow one-click camera focus on any result.
2. WHEN the user toggles visibility of a star-system cluster (`hidden_clusters`) or node category (`visible_node_types`) or adjusts `minEdgeWeight` (`[0.05, 0.65]`) THEN the system SHALL recompute the visible nodes and trajectories immediately while keeping the graph state consistent.
3. The system SHALL display a toggleable cosmic visual legend explaining the visual encoding of artist planets, genre stellar hubs, bridge artist corona/rings, and luminous trajectory weights, alongside clear loading (`role="status"`), error (`role="alert"`), and empty states.

**Independent Test**: Press `/` to search for `"Radiohead"` or `"mpb"`, toggle a cluster's visibility off and on, adjust the edge threshold slider, and open the visual legend.

---

### P2: 2D/3D Toggle, WebGL Context Recovery, GPU Disposal & Reduced-Motion Accessibility

**User Story**: As a user on any device or accessibility configuration, I want seamless 3D ↔ 2D switching, automatic fallback and recovery on WebGL context loss, deterministic GPU resource disposal, and reduced-motion/keyboard accessibility so that the application remains fast, leak-free, and accessible to everyone.

**Why P2**: Ensures performance, accessibility compliance, and zero lock-out on constrained hardware.

**Acceptance Criteria**:

1. WHEN the user toggles between `"3D Espacial"` (`space_3d`) and `"2D Mapa"` (`map_2d`) THEN the system SHALL preserve `selectedNode`, `timeRange`, `graphMode`, `minEdgeWeight`, `searchQuery`, and `hiddenClusters` across both renderers.
2. IF WebGL is unsupported by the browser/device or a `webglcontextlost` event occurs on the 3D canvas THEN the system SHALL prevent default unhandled context termination, automatically switch to the 2D Canvas view with a non-blocking status banner, and WHEN `webglcontextrestored` fires THEN the system SHALL re-enable 3D availability without losing the current graph state.
3. WHILE `prefers-reduced-motion: reduce` is active (or `reduced_motion` is enabled in user preferences) the system SHALL set `autoRotate = false`, `directionalParticles = 0`, `cameraTransitionMs = 0`, and `pulseAmplitude = 0`.
4. WHEN the 3D component unmounts or rebuilds its scene THEN the system SHALL traverse and dispose of all cached Three.js geometries, materials, textures, and label sprites (`disposeThreeUniverse`) so zero unreleased GPU resources remain.

**Independent Test**: Toggle 3D ↔ 2D with a node selected, simulate WebGL unavailability and `webglcontextlost`/`webglcontextrestored`, verify `disposeThreeUniverse` releases all geometries/materials/textures, and verify `prefers-reduced-motion` disables rotation, particles, and camera interpolation.

---

## Edge Cases

- IF `/api/graph` returns an empty `nodes` array THEN the system SHALL render the empty-universe status state (`role="status"`) with guidance to select another time horizon without initializing empty WebGL force loops.
- IF `/api/graph` returns HTTP `401` or `429` THEN the system SHALL display the error message (`role="alert"`), include the `Retry-After` wait hint when present on `429`, and offer `"Reconectar Spotify"` (on `401`) or `"Explorar demonstração"`.
- IF `localStorage` throws `SecurityError` or contains malformed JSON under `beatcode_space_prefs_v1` THEN the system SHALL fall back to sanitized default preferences in memory without crashing.
- WHEN a node's name or genre contains HTML special characters (`<`, `>`, `&`, `"`, `'`) THEN the system SHALL escape all characters via `escapeHtml` before rendering tooltips or sprite labels.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SPACE-01 | P1: 3D Cosmic Universe & Planetary Graph Representation (AC 1, AC 2, AC 4) | Validate | ✅ Verified |
| SPACE-02 | P1: 3D Cosmic Universe & Planetary Graph Representation (AC 3) | Validate | ✅ Verified |
| SPACE-03 | P1: 360° Spatial Camera Navigation & Constellation Focus (AC 1, AC 2) | Validate | ✅ Verified |
| SPACE-04 | P1: 360° Spatial Camera Navigation & Constellation Focus (AC 3, AC 4) | Validate | ✅ Verified |
| SPACE-05 | P1: Planetary Interactivity, Data Provenance & 4-Attribute Edge Decomposition (AC 1, AC 4) | Validate | ✅ Verified |
| SPACE-06 | P1: Planetary Interactivity, Data Provenance & 4-Attribute Edge Decomposition (AC 2, AC 3) | Validate | ✅ Verified |
| SPACE-07 | P2: Spatial HUD, Search, Category/Cluster Filters & Cosmic Legend (AC 1, AC 2) | Validate | ✅ Verified |
| SPACE-08 | P2: Spatial HUD, Search, Category/Cluster Filters & Cosmic Legend (AC 3) | Validate | ✅ Verified |
| SPACE-09 | P2: 2D/3D Toggle, WebGL Context Recovery, GPU Disposal & Reduced-Motion Accessibility (AC 1, AC 2) | Validate | ✅ Verified |
| SPACE-10 | P2: 2D/3D Toggle, WebGL Context Recovery, GPU Disposal & Reduced-Motion Accessibility (AC 3, AC 4) | Validate | ✅ Verified |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Sources

- `AGENTS.md` - Project governance, Maestri parallel orchestration rules, Figma 20-reference visual gate, TLC Spec-Driven workflow, and atomic commit rules
- `docs/PESQUISA_VISUAL_BEATCODE_SPACE.md` - Conceptually Approved Gate Visual Figma (20 verified references + 4 WebGL benchmarks), Observatory HUD 5-zone design system, provenance badges, and accessibility rules
- `openspec/project.md` & `openspec/openapi.yaml` - Official domain conventions and REST API contract for `/api/graph` and `/auth/*`
- `docs/REVISAO_MODELO_MATEMATICO.md` & `docs/PROPOSTA_INTERPRETABILIDADE.md` - Mathematical model review and evidence-based edge explanation guidelines

---

## Success Criteria

- [x] Users can explore both `artists` and `bipartite` real graphs in an immersive 3D space environment where nodes are distinct planets/stellar cores, clusters form constellations, and edges are luminous trajectories governed by deterministic equations.
- [x] Selecting any planet displays 100% real data from `/api/graph` with `[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]` provenance tags, 4-attribute edge weight decomposition (`0.65g + 0.25c + 0.10t` + `shared_genres`), and navigable 1-hop and 2-hop connections.
- [x] All 14 deterministic proofs (`C1`–`C14` covering backend contract, mathematical model, WebGL fallback, context loss/recovery, GPU disposal, reduced motion, and renderer–camera–inspector integration) and Next.js build/lint gates pass with zero errors and independent review approval.
