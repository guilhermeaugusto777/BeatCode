# BeatCode Space — 3D Knowledge Graph Specification (Graphify-Inspired)

## Problem Statement

BeatCode currently renders the user's Spotify musical graph in `frontend/components/SpotifyConstellationGraph.jsx` as a flat 2D canvas or with an early cosmic/planetary visual metaphor (heavy planetary atmospheres, Saturn-like rings, starry cosmic dust) that introduces visual noise, distracts from analytical comprehension, and lacks proportional fidelity to real listening volume. Furthermore, genre filtering previously led to disconnected subgraphs without auto-bipartite switching, and hover events suffered from an intrusive zoom-loss bug where `zoomToFit` was inadvertently re-triggered. Users need an elegant, high-clarity **3D Knowledge Graph inspired by Graphify** (clean 3D nodes, explainable edges, cohesive knowledge clusters, discreet `#050508` dark canvas, deterministic linear listening sizing, cohesive genre projections, and rock-solid camera stability) that turns real graph topology and listening habits into an authoritative, distraction-free analytical knowledge network.

## Goals

- [x] Transform the visualization into an authoritative **3D Knowledge Graph inspired by Graphify**: clean 3D nodes (spheres with high-definition avatars for artists, clean faceted hubs for genres), explainable luminous edges, cohesive Louvain knowledge clusters, and a distraction-free dark background `#050508` (eliminating decorative planetary halos, Saturn-like rings, and cosmic starfield noise).
- [x] Enforce a strictly linear, deterministic listening sizing formula ($D_i = D_{\max} \cdot (L_i / L_{\max})$, $R_i = D_i / 2$) with separate scales for artists ($D_{\max}=28.0, R_{\max}=14.0$) and genres ($D_{\max}=24.0, R_{\max}=12.0$), deduplicated track play count aggregation across genres, and safe geometric fallbacks for missing/invalid $L_i$ that preserve the linear ratio of positive nodes.
- [x] Guarantee cohesive genre exploration with automatic switching to `bipartite` mode on genre filtering, projected `genre-genre` weighted edges ($W(g_1, g_2) = \frac{|A(g_1) \cap A(g_2)|}{|A(g_1) \cup A(g_2)|}$) in `filterSpaceGraph`, and complete bipartite neighborhood inspection in the analytical sidebar.
- [x] Eliminate the hover zoom-loss bug using `hasInitialFitRef` to restrict `zoomToFit` strictly to the initial load and stable `useRef` callbacks for hover/click without re-creating `<ForceGraph3D>` references.
- [x] Provide smooth 360° camera navigation, zoom, pan, node centering, cluster framing, contextual inspection with explicit provenance badges (`[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]`), and 3D ↔ 2D toggle with WebGL context-loss recovery, GPU resource disposal, and `prefers-reduced-motion` compliance.

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

### 1. Rigorous Separation of Spotify Data Sources & Zero Fictitious Counts Invariant

Every musical metric presented in the 3D Knowledge Graph MUST be strictly categorized into one of three distinct, non-fungible Spotify data sources. The system MUST NEVER fabricate, simulate, or extrapolate counts where empirical data is absent:

1. **A. Reprodução Observada (`observed_plays`):**
   - **Definition:** Empirical playback events directly captured from Spotify history (`recent_tracks` with verified ISO timestamps `played_at`, or verified local playback logs).
   - **Semantics:** Represents verified listening occurrences with explicit temporal window identification and deduplication of tracks within playback sessions.
   - **Display Rule:** Displayed strictly as `"Reproduções Observadas"` with the exact observation interval (e.g., `"Últimas 50 reproduções registradas"`).

2. **B. Afinidade Spotify (`affinity_rank`, `affinity_score`, `top_tracks_count`):**
   - **Definition:** Ordinal ranking and algorithmic affinity metrics supplied by Spotify's Top Artists and Top Tracks endpoints across the three official horizons (`short_term`, `medium_term`, `long_term`).
   - **Semantics:** Proprietary Spotify algorithmic affinity score ($S_{\text{aff}} \in [0.25, 1.00]$).
   - **Display Rule:** Tagged as `[DADO SPOTIFY]` and `[INFERÊNCIA BEATCODE]`. It MUST NEVER be presented, labeled, or converted into an absolute number of streams or plays.

3. **C. Biblioteca Salva (`saved_tracks_count`):**
   - **Definition:** Aggregate count of tracks saved by the user in their personal library (`saved_tracks`).
   - **Semantics:** An indicator of personal collection curation and archival preference.
   - **Display Rule:** Tagged as `"Músicas Salvas na Biblioteca"`. It MUST NEVER increment, substitute for, or be combined with listening/stream counts.

#### Zero Fictitious Counts Invariant & Estimated Listening Index
The absence of absolute historical play counts MUST NEVER be disguised by generating fictitious or synthetic play numbers:
- When verified playback logs are available, $L_i$ represents **`observed_plays`**.
- When empirical playback logs are absent or insufficient for absolute counts, $L_i$ transitions cleanly to an **Índice Estimado de Escuta** (`estimated_listening_index`), explicitly labeled as such.
- The UI MUST transparently state the estimation methodology (normalized composite of Spotify affinity score and top-tracks presence across the chosen time horizon) and the evaluated period, and MUST NEVER present this index as an absolute stream/play count.

---

### 2. Input Sanitization & Default Fallbacks for Missing or Invalid Attributes

For any node $u$, link $e = (u, v)$, or `metadata` object with missing (`undefined`, `null`), `NaN`, infinite, or out-of-range fields:

- **Affinity Score ($S_{\text{aff}}(u)$):** If `u.affinity_score` is finite, clamp to $[0.25, 1.00]$; otherwise default to $0.50$. Normalized affinity:
  $$\hat{S}_{\text{aff}}(u) = \text{clamp}\left(\frac{S_{\text{aff}}(u) - 0.25}{0.75}, \ 0.0, \ 1.0\right)$$
- **Global Popularity ($P_{\text{glob}}(u)$):** If `u.global_popularity` is finite, clamp to $[0, 100]$; otherwise default to $50$. Normalized popularity:
  $$\hat{P}_{\text{glob}}(u) = \frac{P_{\text{glob}}(u)}{100.0} \in [0.0, 1.0]$$
- **Centralities ($C_D(u), C_B(u)$):** If `u.metrics?.degree_centrality` (resp. `betweenness_centrality`) is finite, clamp to $[0.0, 1.0]$; otherwise default to $0.0$.
- **Connected Artists Count ($k_g$ for genre nodes):** If `u.connected_artists_count` is finite and $\ge 1$, clamp to $[1, 50]$; otherwise infer from incident edges in `links` (minimum $1$). On artist nodes (`node_type === "artist"`), `connected_artists_count` is explicitly `null`.
- **Node Color & Name:** If `u.color` is missing or not a valid hex color, default to `#1DB954`. If `u.name` is missing or empty, default to `"Desconhecido"`.

---

### 3. Deterministic Linear Listening Sizing Formula ($L_i$) & Node Radii

Node diameters and radii scale strictly linearly with the evidence-backed listening metric $L_i$ (either `observed_plays` when verified logs exist, or the transparently labeled `estimated_listening_index`). This eliminates non-linear distortion and ensures that visual volume matches listening behavior with mathematical rigor:

$$D_i = D_{\max} \times \left(\frac{L_i}{L_{\max}}\right), \quad R_i = \frac{D_i}{2}$$

#### Mandatory Linear Proportionality Examples
The visual scale preserves direct linear ratios between any pair of nodes $i, j$ with $L_i, L_j > 0$:
- **Example 1 ($1000$ vs $500$):**
  $$\frac{D_{1000}}{D_{500}} = \frac{R_{1000}}{R_{500}} = \frac{1000}{500} = 2.0\times$$
- **Example 2 ($1000$ vs $750$):**
  $$\frac{D_{1000}}{D_{750}} = \frac{R_{1000}}{R_{750}} = \frac{1000}{750} = \frac{4}{3} \approx 1.3333\times$$
- **Example 3 ($1500$ vs $1000$):**
  $$\frac{D_{1500}}{D_{1000}} = \frac{R_{1500}}{R_{1000}} = \frac{1500}{1000} = 1.5\times$$

#### Separate Maximum Sizing Scales
To prevent dense genre hubs from overpowering individual artist nodes, separate maximum diameter/radius scales are enforced:
- **Artists (`node_type === "artist"`):**
  $$D_{\max,\text{artist}} = 28.0, \quad R_{\max,\text{artist}} = 14.0$$
- **Genres (`node_type === "genre"`):**
  $$D_{\max,\text{genre}} = 24.0, \quad R_{\max,\text{genre}} = 12.0$$

#### Strict Deduplication by Genre on `(track_id, genre)` Key ($L_g$)
When calculating listening volume for genre nodes ($L_g$), deduplication on the unique key `(track_id, genre)` is mandatory:
- A single unique track associated with genre $g$ featuring multiple collaborative artists of that same genre contributes its play count (or listening weight) **exactly once** to genre $g$. This prevents artificial inflation of genre volumes caused by multi-artist collaborations on the same track.

#### Missing and Invalid Value Fallback ($L_i \le 0$ or `NaN`)
If a node has missing, `null`, `undefined`, non-numeric, or non-positive listening metrics ($L_i \le 0$ or `NaN`):
- `listeningRatio = 0`
- `isFallbackListening = true`
- The system assigns a safe minimum geometric radius $R_{\min,\text{safe}} = 2.0$ ($D_{\min,\text{safe}} = 4.0$) strictly for 3D visibility, hit-testing, and mesh rendering.
- Crucially, this safe minimum does NOT add an arbitrary offset ($+ \text{base}$) to nodes with valid $L_i > 0$, ensuring the linear ratio $\frac{R_i}{R_j} = \frac{L_i}{L_j}$ remains untainted.

---

### 4. Graphify-Inspired Clean 3D Knowledge Graph Visual Encoding

The visualization replaces speculative cosmic/planetary elements (decorative atmospheric halos, Saturn rings, procedural starry skies) with the clean, authoritative design language of Graphify:

- **Clean Node Geometries:** Artists are rendered as crisp 3D spheres with high-definition avatar textures (procedural neutral color on avatar fallback), and genres as faceted polyhedral knowledge hubs.
- **Discreet Dark Canvas (`#050508`):** The 3D scene renders against a calm, deep neutral void (`#050508`), eliminating starfield particles, dust clouds, and visual clutter to optimize contrast and focus.
- **Knowledge Cluster Envelopes:** Louvain community clusters are rendered as cohesive epistemic knowledge groupings. On hover or selection, the active cluster displays a subtle, clean convex hull/wireframe envelope rather than speculative planetary orbits.
- **Focused State Illumination:** Instead of decorative atmospheres, selected and hovered nodes receive a clean, sharp focus rim with high-contrast text billboard labels.

---

### 5. Genre Graph Cohesion & Full Neighborhood Preservation

- **Automatic Bipartite Switching:** Whenever the user filters by `genre` (via search query, node-type filter, or clicking a genre pill in the HUD), the system SHALL automatically comute the active graph mode to `bipartite`.
- **Projected Genre-Genre Edges in `filterSpaceGraph`:** When isolating genre relationships, the system projects direct `genre-genre` weighted edges based on normalized Jaccard overlap of shared artists:
  $$W(g_1, g_2) = \frac{|A(g_1) \cap A(g_2)|}{|A(g_1) \cup A(g_2)|} \in [0.0, 1.0]$$
- **Full Neighborhood Preservation in Inspector:** When a genre node is inspected, the sidebar displays its complete bipartite neighborhood (all incident artists, individual play counts, edge weights, and shared genre overlap) without dropping connections or truncating unipartite/bipartite boundaries.

---

### 6. Hover Camera Zoom Stability Architecture

- **`hasInitialFitRef` Guard:** A stable reference `hasInitialFitRef` prevents `<ForceGraph3D>`'s `onEngineStop` callback from triggering `zoomToFit` after the initial graph load and simulation stabilization. Subsequent physics ticks or engine stops triggered by hover or focus updates MUST NOT reset the user's camera zoom.
- **Stable Callback References:** All hover, click, and interaction handlers passed to `<ForceGraph3D>` (`onNodeHover`, `onLinkHover`, `onNodeClick`, `onBackgroundClick`) MUST maintain stable references across component re-renders (via `useRef` and `useCallback`), preventing unneeded canvas unmounting, stage re-centering, or camera matrix jitter.

---

### 7. 3D Knowledge Cluster Centroids ($\mathbf{C}_k$)

- Given $K = \max(\text{clusters.length}, 1)$ and Louvain modularity $Q = \text{clamp}(\text{Number.isFinite}(\text{metadata?.modularity\_score}) \ ? \ \text{metadata.modularity\_score} : 0.0, \ -0.5, \ 1.0)$:
  $$R_{\text{galaxy}} = 220.0 \cdot \left(1.0 + 1.8 \cdot \max(0.0, Q)\right) \in [220.0, 616.0]$$
- With Golden Angle $\varphi = \pi \cdot (3 - \sqrt{5}) \approx 2.39996323 \text{ rad}$, for cluster index $k \in \{0, \dots, K-1\}$:
  - If $K === 1$: $\mathbf{C}_0 = (0.0, 0.0, 0.0)$.
  - If $K > 1$:
    $$z_k = 1.0 - \frac{2k + 1}{K}, \quad \rho_k = \sqrt{\max(0.0, 1.0 - z_k^2)}, \quad \theta_k = k \cdot \varphi$$
    $$\mathbf{C}_k = \left(\text{round}(R_{\text{galaxy}} \rho_k \cos\theta_k, 2), \ \text{round}(R_{\text{galaxy}} \rho_k \sin\theta_k, 2), \ \text{round}(R_{\text{galaxy}} z_k, 2)\right)$$

### 8. Edge Weight Composition (`0.65g + 0.25c + 0.10t`) & Role of the Four Connection Attributes

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

### 9. 2-Hop Indirect Connection Relevance ($A_{2\text{hop}}(u, z)$)

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
| 3D rendering engine on Next.js 16 / React 19 | `react-force-graph-3d` + `three` loaded via `next/dynamic` (`ssr: false`) and locked in `package.json` + `package-lock.json` | Integrates directly with the force-graph data model and supports clean Graphify-inspired 3D nodes, cluster centroids, and camera stability | y |
| Pure domain model separation | Extract all deterministic linear listening sizing, cluster centroids, filtering, search, 1-hop/2-hop neighbor ranking, genre projections, and `0.65g + 0.25c + 0.10t` decomposition into `frontend/lib/spaceGraphModel.js` | Enforces TLC rule #6 so every mathematical formula, filter, search, and count is verified by automated tests (`node --test`) | y |
| Graphify-inspired visual language | Discreet `#050508` dark canvas, clean avatar spheres, faceted genre hubs, knowledge cluster hulls, zero planetary rings or atmospheric halos | Replaces decorative cosmic clutter with an authoritative, distraction-free knowledge graph | y |
| Linear listening sizing proportionality | $D_i = D_{\max} \cdot (L_i / L_{\max})$, $R_i = D_i / 2$ with separate artist ($D_{\max}=28.0, R_{\max}=14.0$) and genre ($D_{\max}=24.0, R_{\max}=12.0$) scales | Enforces strictly linear visual volume matching real listening volume without non-linear distortion | y |
| Deduplicated genre listening aggregation | Deduplicate track play counts across genres ($L_g$) so each unique track contributes its count once per genre | Prevents artificial inflation of genre nodes with frequent multi-artist collaborations | y |
| Genre graph cohesion & auto-bipartite | Auto-switch to `bipartite` on genre filter, project `genre-genre` edges in `filterSpaceGraph`, and preserve complete neighborhood in Inspector | Eliminates disconnected/empty genre graphs and maintains complete contextual navigation | y |
| Hover camera zoom stability | `hasInitialFitRef` preventing `zoomToFit` in `onEngineStop` after initial load, and stable `useRef` for hover/click callbacks | Fixes intrusive camera zoom reset bug when hovering over nodes | y |
| Backend contract for `connected_artists_count` & data provenance | Ensure `backend/main.py` returns `connected_artists_count` on every `GraphNode` (`int >= 1` for `genre` nodes, `null` for `artist` nodes), document in `openspec/openapi.yaml`, and verify with FastAPI integration tests in `backend/tests/test_api.py` | Verifies the live backend service delivery rather than relying on OpenAPI documentation alone | y |
| Client preference persistence | Store non-sensitive UI preferences (`view_mode`, `min_edge_weight`, `hidden_clusters`, `visible_node_types`, `visual_effects`, `recent_planets`) under `localStorage` key `beatcode_space_prefs_v1` with defensive fallback | Preserves user exploration preferences across reloads while upholding the zero-secret invariant | y |
| Input validation & bounds | Clamp `min_edge_weight` to `[0.05, 0.65]`, sanitize all tooltip HTML via `escapeHtml()`, cap search queries at 80 characters, and apply deterministic defaults for missing/NaN node or link fields | Prevents XSS (CWE-79), `NaN` geometry corruption in Three.js, and out-of-range filter states | y |
| Failure / partial-failure states & External-dependency failure | Detect missing WebGL support or `webglcontextlost` / `webglcontextrestored` events to automatically fall back to 2D Canvas mode and recover cleanly; fallback to procedural neutral surface when Spotify CDN image fails or blocks CORS | Guarantees uninterrupted exploration on restricted GPUs or offline/demo environments | y |
| Idempotency / retry / duplicate handling | Cancel in-flight `/api/graph` requests on parameter change and reuse flyweight Three.js geometries/textures with deterministic disposal (`disposeThreeUniverse`) | Prevents duplicate meshes, race conditions on rapid filter toggles, and GPU VRAM leaks | y |
| Auth boundaries & rate limits | Preserve `credentials: "include"` and `cache: "no-store"` on `/auth/*` and `/api/graph`, and surface HTTP `429` `Retry-After` hints in the error state | Maintains existing browser-isolated OAuth security and rate-limit clarity | y |
| Concurrency / ordering & State-transition integrity | Guard view transitions (`welcome` → `checking` → `demo`/`spotify` and `3D` ↔ `2D`) so switching between 2D and 3D retains `selectedNode`, `timeRange`, `graphMode`, `minEdgeWeight`, and `hiddenClusters` | Ensures state continuity during exploration | y |
| Data lifecycle / expiry & Observability | Cap `recent_planets` history at 10 items in client storage and expose live topological telemetry with explicit provenance badges (`[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]`) in the HUD | Keeps local storage bounded (<2 KB) and maintains strict transparency between measured data and inferences | y |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: 3D Knowledge Graph Representation (Graphify-Inspired) ⭐ MVP

**User Story**: As a music explorer and researcher, I want my Spotify artist and genre graphs rendered as an authoritative 3D Knowledge Graph inspired by Graphify (clean 3D nodes, explainable edges, Louvain knowledge clusters, and a distraction-free dark canvas `#050508`) with strictly linear sizing proportional to my listening volume ($L_i$) so that visual prominence directly and mathematically reflects listening behavior without cosmic clutter.

**Why P1**: Core visual, mathematical, and architectural foundation of the BeatCode 3D Knowledge Graph.

**Acceptance Criteria**:

1. WHEN the graph loads in 3D mode with `graph_mode="artists"` THEN the system SHALL render each artist node as a clean 3D sphere with deterministic radius $R_i = \frac{D_{\max,\text{artist}}}{2} \cdot \left(\frac{L_i}{L_{\max}}\right) \in (0.0, 14.0]$ where $D_{\max,\text{artist}} = 28.0$ and $R_{\max,\text{artist}} = 14.0$, strictly preserving linear ratios ($1000$ vs $500 \implies 2.0\times$; $1000$ vs $750 \implies 1.3333\times$; $1500$ vs $1000 \implies 1.5\times$).
2. WHEN the graph loads in 3D mode with `graph_mode="bipartite"` THEN the system SHALL render artist nodes with $R_{\max,\text{artist}} = 14.0$ and genre nodes as clean polyhedral hubs with radius $R_g = \frac{D_{\max,\text{genre}}}{2} \cdot \left(\frac{L_g}{L_{\max}}\right) \in (0.0, 12.0]$ where $D_{\max,\text{genre}} = 24.0$ and $R_{\max,\text{genre}} = 12.0$, where $L_g$ is computed by aggregating track play counts across unique songs in that genre (deduplicating multi-artist collaborations).
3. IF a node has missing, non-positive, or non-finite listening counts ($L_i \le 0$ or `NaN`) THEN the system SHALL set `listeningRatio = 0`, flag `isFallbackListening = true`, and assign a safe geometric radius $R_{\min,\text{safe}} = 2.0$ without corrupting or offsetting the strictly linear ratio of positive nodes.
4. WHEN the 3D scene initializes THEN the system SHALL position Louvain knowledge cluster centroids on a 3D Fibonacci sphere of radius $R_{\text{galaxy}} = 220 \cdot (1 + 1.8 \cdot \max(0, Q))$ and render on a calm `#050508` dark canvas with luminous explainable edge trajectories whose width and opacity reflect `link.weight`, with zero decorative atmospheric halos, Saturn rings, or starry background noise.
5. WHEN the user filters by `genre` in search or the HUD THEN the system SHALL automatically switch to `bipartite` mode, generate projected `genre-genre` weighted edges in `filterSpaceGraph`, and preserve the complete bipartite neighborhood in the analytical inspector.
6. WHILE the user hovers over any node in 3D mode THEN the system SHALL NOT reset camera zoom or trigger `zoomToFit` on engine stop (`hasInitialFitRef = true`), preserving manual camera position and zoom level.

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
2. WHEN a node or genre hub is selected THEN the system SHALL display in the contextual sidebar its attributes rigorously categorized across the three Spotify sources:
   - **A. Reprodução Observada:** `observed_plays` (verified timestamped history events or verified logs, with observation period noted) OR `estimated_listening_index` (clearly identified as an algorithmic composite of affinity and top tracks, NEVER presented as raw play counts).
   - **B. Afinidade Spotify:** `affinity_rank`, `affinity_score`, `top_tracks_count` tagged with `[DADO SPOTIFY]` and `[INFERÊNCIA BEATCODE]`, NEVER displayed as stream counts.
   - **C. Biblioteca Salva:** `saved_tracks_count` tagged as library archival metric, NEVER added to or combined with play counts.
   The system SHALL enforce the Zero Fictitious Counts invariant: zero fabricated stream numbers are ever generated.
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

- [x] Users can explore both `artists` and `bipartite` real graphs in an authoritative **3D Knowledge Graph inspired by Graphify** against a clean `#050508` dark canvas, where nodes are distinct 3D spheres/polyhedra whose radii scale strictly linearly with listening counts ($L_i$), clusters form cohesive knowledge groupings, and edges are explainable luminous trajectories.
- [x] Selecting any artist or genre displays 100% real data from `/api/graph` with `[DADO SPOTIFY]` vs `[INFERÊNCIA BEATCODE]` provenance tags, 4-attribute edge weight decomposition (`0.65g + 0.25c + 0.10t` + `shared_genres`), complete bipartite neighborhood navigation, and auto-bipartite switching on genre filter.
- [x] Camera interaction is rock-solid without zoom loss on hover (`hasInitialFitRef` guard and stable callback refs).
- [x] All 19 deterministic proofs (`C1`–`C19` covering backend contract, mathematical linear sizing, Graphify-inspired rendering, genre graph cohesion, hover zoom stability, WebGL fallback, context loss/recovery, GPU disposal, reduced motion, and renderer–camera–inspector integration) and Next.js build/lint gates pass with zero errors and independent review approval.
