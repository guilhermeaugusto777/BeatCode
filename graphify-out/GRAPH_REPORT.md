# Graph Report - 1e2416ad-de99-41dd-920b-193e2e5eed44  (2026-11-11)

## Corpus Check
- 67 files · ~82,349 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 531 nodes · 680 edges · 203 communities (9 shown, 194 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 40
- Community 41
- Community 42
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 53
- Community 55
- Community 56
- Community 58
- Community 59
- Community 60
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 68
- Community 69
- Community 71
- Community 72
- Community 73
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 102
- Community 104
- Community 105
- Community 106
- Community 107
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 135
- Community 136
- Community 137
- Community 138
- Community 140
- Community 142
- Community 143
- Community 144
- Community 146
- Community 147
- Community 148
- Community 149
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 186
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 195
- Community 196
- Community 197
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202

## God Nodes (most connected - your core abstractions)
1. `SpotifyConstellationGraph()` - 21 edges
2. `compute_unipartite_artist_graph()` - 17 edges
3. `temporal_matrix()` - 13 edges
4. `build_genre_corpus()` - 12 edges
5. `compute_bipartite_artist_genre_graph()` - 12 edges
6. `compute_genre_similarity()` - 11 edges
7. `client_with_session()` - 10 edges
8. `loadSpacePreferences()` - 10 edges
9. `get_session()` - 9 edges
10. `get_demo_dataset()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `genre_features()` --calls--> `normalize_genre()`  [EXTRACTED]
  backend/experiments/genre_representation.py → backend/genre_representation.py
- `test_invalid_parameters_are_rejected()` --calls--> `temporal_matrix()`  [EXTRACTED]
  backend/tests/test_temporal_experiments.py → backend/experiments/temporal_models.py
- `test_session_boundary_uses_consecutive_gap_and_window()` --calls--> `temporal_matrix()`  [EXTRACTED]
  backend/tests/test_temporal_experiments.py → backend/experiments/temporal_models.py
- `build_genre_corpus()` --calls--> `build_compatible_genre_corpus()`  [EXTRACTED]
  backend/main.py → backend/genre_representation.py
- `test_empty_graph_has_no_nodes_or_links()` --calls--> `compute_unipartite_artist_graph()`  [EXTRACTED]
  backend/tests/test_graph.py → backend/main.py

## Import Cycles
- None detected.

## Communities (203 total, 194 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (52): attachWebGLContextListeners(), configureSpaceForces3D(), createCosmicStarfield(), createPlanetObject3D(), createProceduralLabelCanvas(), createProceduralPlanetCanvas(), createResourceRegistry(), disposeThreeUniverse() (+44 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (45): Any, normalize_genre(), build_genre_corpus(), compute_bipartite_artist_genre_graph(), compute_genre_similarity(), compute_unipartite_artist_graph(), extract_artist_tracks_and_collabs(), get_artist_genres() (+37 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (41): ForceGraph2D, ForceGraph3D, dependencies, d3-force, lucide-react, next, react, react-dom (+33 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (38): auth_status(), callback(), cleanup_expired_sessions(), fetch_spotify_items(), get_music_graph(), get_session(), get_spotify_client(), get_spotify_oauth() (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (29): compare(), evaluate(), main_report(), ordering_stability(), Mede o impacto de três heurísticas temporais no grafo sintético., use_temporal_matrix(), _artist(), make_profile() (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (16): client_with_session(), FailingSpotify, test_incomplete_cached_token_requires_reconnection(), test_incomplete_spotify_artist_item_returns_bad_gateway(), test_incomplete_spotify_response_is_not_silently_empty(), test_spotify_expired_or_invalid_token_requires_reconnection(), test_spotify_forbidden_is_explained_without_upstream_details(), test_spotify_network_failure_returns_service_unavailable() (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (17): client(), fixture, session_cookie(), begin_login(), complete_login(), fake_spotify(), FakeOAuth, FakeSpotify (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (23): compare(), evaluate(), Compare modelos de gênero sem alterar a API ou o grafo em produção., use_similarity(), compatible_genre_cosine_matrix(), genre_cosine_matrix(), genre_features(), legacy_genre_cosine_matrix() (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.50
Nodes (7): evalInPortal(), main(), runPortal(), sleep(), waitForCondition(), ref_node_assert_strict, ref_node_child_process

## Knowledge Gaps
- **200 isolated node(s):** `metadata`, `GRAPH_MODE_OPTIONS`, `TIME_RANGE_OPTIONS`, `NODE_TYPE_OPTIONS`, `VIEW_MODE_OPTIONS` (+195 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 321 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **194 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `compute_unipartite_artist_graph()` connect `Community 1` to `Community 3`, `Community 4`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `metadata`, `GRAPH_MODE_OPTIONS`, `TIME_RANGE_OPTIONS` to the rest of the system?**
  _200 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07536231884057971 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10017730496453901 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09230769230769231 - nodes in this community are weakly interconnected._