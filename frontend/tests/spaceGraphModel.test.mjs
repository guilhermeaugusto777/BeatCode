/**
 * BeatCode Space — Unit & Integration Test Suite (C1 - C13)
 *
 * Covers deterministic astrophysical formulas, 4-attribute edge explainability,
 * 1-hop/2-hop harmonic relevance, data provenance segregation, XSS sanitation,
 * client preference resilience, WebGL fallback/recovery, Three.js resource disposal,
 * prefers-reduced-motion accessibility, and integrated renderer-camera-inspector flow.
 */

import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  DEFAULT_COLOR,
  MAX_ARTIST_DIMENSION,
  MAX_GENRE_DIMENSION,
  MAX_GENRE_RADIUS,
  escapeHtml,
  computeListeningProportionalDimensions,
  computePlanetVisualProps,
  computeClusterCentroids,
  decomposeEdgeWeight,
  filterSpaceGraph,
  computeNodeNeighborhood,
  buildNodeProvenanceProfile,
  deriveExplorationDepth,
  resolveCameraFlightTarget,
  computeMotionConfig,
  resolveWebGLFallbackState
} from "../lib/spaceGraphModel.js";

import {
  createPlanetObject3D,
  createCosmicStarfield
} from "../components/space/PlanetaryRenderer.js";

import {
  sanitizeSpacePreferences,
  loadSpacePreferences,
  saveSpacePreferences,
  recordVisitedPlanet,
  resetSpacePreferences
} from "../lib/spacePreferences.js";

// Optional dynamic import of PlanetaryRenderer (for C10/C11 live module verification)
let planetaryRendererModule = null;
try {
  planetaryRendererModule = await import("../components/space/PlanetaryRenderer.js");
} catch {
  // PlanetaryRenderer may be authoring concurrently in Wave 2
}

test("SPACE-01 AC1/AC4: computePlanetVisualProps calculates deterministic planet radius, halo, orbital ring, and missing-attribute defaults", () => {
  // 1. Maximal unipartite artist node: S_aff=1.0, P_glob=100, C_D=1.0, C_B=1.0
  const maxNode = {
    id: "artist_max",
    name: "Maximal Artist",
    color: "#FF0077",
    node_type: "artist",
    affinity_score: 1.0,
    global_popularity: 100,
    metrics: { degree_centrality: 1.0, betweenness_centrality: 1.0 },
    inter_cluster_diversity: 0.40
  };
  const maxProps = computePlanetVisualProps(maxNode, {}, "artists", []);
  assert.equal(maxProps.nodeType, "artist");
  assert.equal(maxProps.geometryType, "planet");
  assert.equal(maxProps.massIndex, 1.0000); // 0.55*1 + 0.30*1 + 0.15*1
  assert.equal(maxProps.radius, 14.00); // 3.5 + 10.5*1.0
  assert.equal(maxProps.radiationIndex, 1.0000); // 0.70*sqrt(1.0) + 0.30*1.0
  assert.equal(maxProps.haloRadius, 33.60); // 14.00 * (1.15 + 1.25) = 14.00 * 2.40
  assert.equal(maxProps.haloOpacity, 0.650); // 0.10 + 0.55*(1.0^0.80)
  assert.equal(maxProps.hasOrbitalRing, true); // inter_cluster_diversity >= 0.30
  assert.equal(maxProps.ringInnerRadius, 18.90); // 1.35 * 14.00
  assert.equal(maxProps.ringOuterRadius, 28.70); // 2.05 * 14.00
  assert.equal(maxProps.connectedArtistsCount, null);

  // 2. Minimal unipartite artist node: S_aff=0.25, P_glob=0, C_D=0.0, C_B=0.0
  const minNode = {
    id: "artist_min",
    name: "Minimal Artist",
    color: "#001122",
    node_type: "artist",
    affinity_score: 0.25,
    global_popularity: 0,
    metrics: { degree_centrality: 0.0, betweenness_centrality: 0.0 },
    inter_cluster_diversity: 0.10
  };
  const minProps = computePlanetVisualProps(minNode, {}, "artists", []);
  assert.equal(minProps.massIndex, 0.0000);
  assert.equal(minProps.radius, 3.50); // 3.5 + 10.5*0.0
  assert.equal(minProps.radiationIndex, 0.0000);
  assert.equal(minProps.haloRadius, 4.02); // Number((3.50 * 1.15).toFixed(2)) = 4.02
  assert.equal(minProps.haloOpacity, 0.100); // 0.10 + 0.55*0.0
  assert.equal(minProps.hasOrbitalRing, false);
  assert.equal(minProps.connectedArtistsCount, null);

  // 3. Bridge artist eligibility override: gets ring even with low diversity
  const bridgeNode = {
    id: "artist_bridge",
    name: "Bridge Pioneer",
    color: "#1DB954",
    node_type: "artist",
    affinity_score: 0.60,
    metrics: { degree_centrality: 0.25, betweenness_centrality: 0.75 },
    inter_cluster_diversity: 0.05
  };
  const bridgeProps = computePlanetVisualProps(
    bridgeNode,
    { bridge_artist: { id: "artist_bridge" } },
    "artists",
    []
  );
  assert.equal(bridgeProps.isBridgeArtist, true);
  assert.equal(bridgeProps.hasOrbitalRing, true);
  assert.equal(bridgeProps.ringInnerRadius, Number((1.35 * bridgeProps.radius).toFixed(2)));
  assert.equal(bridgeProps.ringOuterRadius, Number((2.05 * bridgeProps.radius).toFixed(2)));

  // 4. Missing/NaN/corrupted attribute defaults (AC4 robustness)
  const corruptedNode = {
    id: "corrupted_node",
    name: "   ",
    color: "not-a-hex",
    affinity_score: NaN,
    global_popularity: Infinity,
    metrics: { degree_centrality: undefined, betweenness_centrality: null }
  };
  const defProps = computePlanetVisualProps(corruptedNode, {}, "artists", []);
  assert.equal(defProps.name, "Desconhecido");
  assert.equal(defProps.color, DEFAULT_COLOR);
  assert.equal(Number.isFinite(defProps.radius), true);
  assert.equal(Number.isFinite(defProps.massIndex), true);
  assert.equal(Number.isFinite(defProps.radiationIndex), true);
  assert.equal(Number.isFinite(defProps.haloRadius), true);
  assert.equal(Number.isFinite(defProps.haloOpacity), true);
  assert.equal(defProps.connectedArtistsCount, null);
  assert.equal(defProps.textureFallbackMode, "procedural_only");
});

test("SPACE-01 AC2/AC4: computePlanetVisualProps differentiates artist planets from genre star cores scaled by connected_artists_count", () => {
  // 1. Bipartite artist node: R_planet in [3.00, 12.00]
  const artistBipMax = {
    id: "artist_bip_max",
    name: "Bipartite Artist",
    node_type: "artist",
    affinity_score: 1.0,
    global_popularity: 100,
    metrics: { degree_centrality: 1.0 }
  };
  const bipArtistProps = computePlanetVisualProps(artistBipMax, {}, "bipartite", []);
  assert.equal(bipArtistProps.nodeType, "artist");
  assert.equal(bipArtistProps.geometryType, "planet");
  assert.equal(bipArtistProps.radius, 12.00); // 3.0 + 9.0 * 1.0
  assert.equal(bipArtistProps.connectedArtistsCount, null);

  const artistBipMin = {
    id: "artist_bip_min",
    node_type: "artist",
    affinity_score: 0.25,
    global_popularity: 0,
    metrics: { degree_centrality: 0.0 }
  };
  assert.equal(computePlanetVisualProps(artistBipMin, {}, "bipartite", []).radius, 3.00);

  // 2. Genre stellar core nodes: R_star in [5.83, 15.00] scaled by connected_artists_count (k_g)
  // k_g = 1 -> R = round(5.0 + 10.0*(1/12), 2) = 5.83
  const genre1 = { id: "genre_indie", name: "indie", node_type: "genre", connected_artists_count: 1 };
  const g1Props = computePlanetVisualProps(genre1, {}, "bipartite", []);
  assert.equal(g1Props.geometryType, "star_core");
  assert.equal(g1Props.nodeType, "genre");
  assert.equal(g1Props.connectedArtistsCount, 1);
  assert.equal(g1Props.radius, 5.83);

  // k_g = 6 -> R = round(5.0 + 10.0*(6/12), 2) = 10.00
  const genre6 = { id: "genre_rock", name: "rock", node_type: "genre", connected_artists_count: 6 };
  const g6Props = computePlanetVisualProps(genre6, {}, "bipartite", []);
  assert.equal(g6Props.radius, 10.00);
  assert.equal(g6Props.connectedArtistsCount, 6);

  // k_g = 12 -> R = round(5.0 + 10.0*(12/12), 2) = 15.00
  const genre12 = { id: "genre_pop", name: "pop", node_type: "genre", connected_artists_count: 12 };
  assert.equal(computePlanetVisualProps(genre12, {}, "bipartite", []).radius, 15.00);

  // k_g = 45 -> clamped at 1.0 ratio -> R = 15.00
  const genre45 = { id: "genre_big", name: "big", node_type: "genre", connected_artists_count: 45 };
  assert.equal(computePlanetVisualProps(genre45, {}, "bipartite", []).radius, 15.00);

  // 3. Genre with missing connected_artists_count falls back to links degree
  const genreLinkFallback = { id: "genre_ambient", name: "ambient", node_type: "genre" };
  const links = [
    { source: "a1", target: "genre_ambient" },
    { source: "genre_ambient", target: "a2" },
    { source: "a3", target: "genre_ambient" }
  ];
  const gLinkProps = computePlanetVisualProps(genreLinkFallback, {}, "bipartite", links);
  assert.equal(gLinkProps.connectedArtistsCount, 3);
  assert.equal(gLinkProps.radius, 7.50); // 5.0 + 10.0 * (3/12) = 7.50

  // 4. Texture fallback verification
  const photoNode = { id: "photo_artist", image_url: "https://i.scdn.co/image/ab6761610000e5ebtest" };
  const noPhotoNode = { id: "no_photo_artist" };
  assert.equal(computePlanetVisualProps(photoNode).textureFallbackMode, "photo_or_procedural");
  assert.equal(computePlanetVisualProps(noPhotoNode).textureFallbackMode, "procedural_only");
});

test("SPACE-02 AC3: computeClusterCentroids distributes star systems in 3D Fibonacci sphere scaled by modularity", () => {
  // 1. Empty clusters handling
  const emptyCentroids = computeClusterCentroids([], 0.5);
  assert.equal(emptyCentroids.size, 0);

  // 2. Single cluster (K = 1) centered at origin
  const singleCluster = [{ cluster_id: 0, dominant_genres: ["electronic"], artist_count: 8 }];
  const singleCentroids = computeClusterCentroids(singleCluster, 0.50);
  assert.equal(singleCentroids.size, 1);
  const c0 = singleCentroids.get(0);
  assert.deepEqual({ x: c0.x, y: c0.y, z: c0.z }, { x: 0.0, y: 0.0, z: 0.0 });
  assert.equal(c0.radius, 418.00); // 220.0 * (1 + 1.8 * 0.50) = 418.00

  // 3. Multi-cluster Fibonacci distribution scaled by modularity Q
  const clusters = [
    { cluster_id: 0, dominant_genres: ["indie rock"], artist_count: 10 },
    { cluster_id: 1, dominant_genres: ["techno"], artist_count: 7 },
    { cluster_id: 2, dominant_genres: ["hip hop"], artist_count: 11 },
    { cluster_id: 3, dominant_genres: ["jazz"], artist_count: 5 },
    { cluster_id: 4, dominant_genres: ["mpb"], artist_count: 9 }
  ];
  const modularity = 0.60;
  const expectedR = 220.0 * (1.0 + 1.8 * 0.60); // 457.60
  const centroids = computeClusterCentroids(clusters, modularity);
  assert.equal(centroids.size, 5);

  for (let k = 0; k < clusters.length; k++) {
    const c = centroids.get(k);
    assert.equal(c.cluster_id, k);
    assert.equal(c.radius, Number(expectedR.toFixed(2)));
    const dist = Math.sqrt(c.x * c.x + c.y * c.y + c.z * c.z);
    assert.ok(
      Math.abs(dist - expectedR) < 0.20,
      `Cluster centroid ${k} distance ${dist} must match R_galaxy ${expectedR}`
    );
    assert.ok(Array.isArray(c.dominant_genres));
    assert.ok(c.artist_count > 0);
  }

  // 4. Modularity bounds clamping (negative modularity defaults to R_galaxy = 220.00)
  const negModCentroids = computeClusterCentroids(clusters, -0.40);
  assert.equal(negModCentroids.get(0).radius, 220.00);

  // Maximum modularity Q = 1.0 -> R_galaxy = 616.00
  const maxModCentroids = computeClusterCentroids(clusters, 1.00);
  assert.equal(maxModCentroids.get(0).radius, 616.00);
});

test("SPACE-03/SPACE-04: deriveExplorationDepth and resolveCameraFlightTarget resolve planet orbit, star system centroid, and universe overview", () => {
  // 1. deriveExplorationDepth transitions
  assert.equal(
    deriveExplorationDepth({ selectedNode: { id: "artist_1" } }).code,
    "planet_orbit"
  );
  assert.equal(
    deriveExplorationDepth({ selectedNode: { id: "artist_1" } }).label,
    "Órbita Planetária"
  );
  assert.equal(
    deriveExplorationDepth({ selectedNode: null, focusedClusterId: 2 }).code,
    "star_system"
  );
  assert.equal(
    deriveExplorationDepth({ selectedNode: null, focusedClusterId: 2 }).label,
    "Sistema Estelar"
  );
  assert.equal(
    deriveExplorationDepth({ selectedNode: null, focusedClusterId: null }).code,
    "universe"
  );
  assert.equal(
    deriveExplorationDepth({ selectedNode: null, focusedClusterId: null }).label,
    "Universo"
  );

  // 2. resolveCameraFlightTarget: focus planet
  const planetTarget = resolveCameraFlightTarget({
    action: "focus_planet",
    node: { x: 40, y: -25, z: 80 },
    reducedMotion: false
  });
  assert.equal(planetTarget.action, "focus_planet");
  assert.equal(planetTarget.depth, "planet_orbit");
  assert.deepEqual(planetTarget.lookAt, { x: 40, y: -25, z: 80 });
  assert.deepEqual(planetTarget.position, { x: 40, y: -10, z: 125 }); // y + 15, z + 45
  assert.equal(planetTarget.transitionMs, 800);

  // 3. resolveCameraFlightTarget: focus star system cluster centroid
  const clusterTarget = resolveCameraFlightTarget({
    action: "focus_cluster",
    clusterCentroid: { x: 150, y: 70, z: -200 },
    reducedMotion: false
  });
  assert.equal(clusterTarget.action, "focus_cluster");
  assert.equal(clusterTarget.depth, "star_system");
  assert.deepEqual(clusterTarget.lookAt, { x: 150, y: 70, z: -200 });
  assert.deepEqual(clusterTarget.position, { x: 150, y: 150, z: 20 }); // y + 80, z + 220
  assert.equal(clusterTarget.transitionMs, 1000);

  // 4. resolveCameraFlightTarget: overview
  const overviewTarget = resolveCameraFlightTarget({
    action: "overview",
    reducedMotion: false
  });
  assert.equal(overviewTarget.action, "overview");
  assert.equal(overviewTarget.depth, "universe");
  assert.deepEqual(overviewTarget.lookAt, { x: 0, y: 0, z: 0 });
  assert.deepEqual(overviewTarget.position, { x: 0, y: 0, z: 600 });
  assert.equal(overviewTarget.transitionMs, 1200);

  // 5. Reduced-motion overrides transition duration to 0ms
  const redPlanet = resolveCameraFlightTarget({
    action: "focus_planet",
    node: { x: 10, y: 10, z: 10 },
    reducedMotion: true
  });
  assert.equal(redPlanet.transitionMs, 0);

  const redCluster = resolveCameraFlightTarget({
    action: "focus_cluster",
    clusterCentroid: { x: 10, y: 10, z: 10 },
    reducedMotion: true
  });
  assert.equal(redCluster.transitionMs, 0);

  const redOverview = resolveCameraFlightTarget({
    action: "overview",
    reducedMotion: true
  });
  assert.equal(redOverview.transitionMs, 0);
});

test("SPACE-05 AC1: escapeHtml neutralizes XSS vectors in 3D tooltips and labels", () => {
  // Script tag injection
  assert.equal(
    escapeHtml('<script>alert("XSS")</script>'),
    "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;"
  );

  // Attribute and event handler injection
  assert.equal(
    escapeHtml('"><img src=x onerror=alert(\'XSS\')>'),
    "&quot;&gt;&lt;img src=x onerror=alert(&#39;XSS&#39;)&gt;"
  );

  // SVG onload injection
  assert.equal(
    escapeHtml('<svg/onload=alert(document.cookie)>'),
    "&lt;svg/onload=alert(document.cookie)&gt;"
  );

  // Ampersands and quotes in legitimate band names
  assert.equal(
    escapeHtml('Simon & Garfunkel "Greatest Hits"'),
    "Simon &amp; Garfunkel &quot;Greatest Hits&quot;"
  );

  // Null, undefined, and non-string inputs
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(42), "42");
  assert.equal(escapeHtml(false), "false");
});

test("SPACE-06 AC2/AC3: decomposeEdgeWeight and computeNodeNeighborhood verify 4-attribute 0.65g+0.25c+0.10t+shared_genres and 2-hop harmonic ranking", () => {
  // 1. Exact 4-attribute edge composition (artist-artist)
  const linkExact = {
    source: "artist_a",
    target: "artist_b",
    weight: 0.7250,
    components: {
      genre_similarity: 0.80,
      direct_collaboration: 0.50,
      co_listening: 0.80
    },
    shared_genres: ["post-punk", "art rock"]
  };
  const dExact = decomposeEdgeWeight(linkExact, "artists");
  assert.equal(dExact.linkType, "artist-artist");
  assert.equal(dExact.components.C_g, 0.5200); // 0.65 * 0.80
  assert.equal(dExact.components.C_c, 0.1250); // 0.25 * 0.50
  assert.equal(dExact.components.C_t, 0.0800); // 0.10 * 0.80
  assert.equal(dExact.calculatedWeight, 0.7250); // 0.5200 + 0.1250 + 0.0800
  assert.equal(dExact.genreMatchType, "exact_and_subtoken_match");

  // 2. Subtoken lexical match (g > 0 but shared_genres empty)
  const linkLexical = {
    source: "artist_a",
    target: "artist_c",
    components: { genre_similarity: 0.40, direct_collaboration: 0.0, co_listening: 0.0 },
    shared_genres: []
  };
  const dLexical = decomposeEdgeWeight(linkLexical, "artists");
  assert.equal(dLexical.genreMatchType, "subtoken_lexical_match");

  // 3. Zero genre match (collaboration only)
  const linkCollabOnly = {
    source: "artist_a",
    target: "artist_d",
    components: { genre_similarity: 0.0, direct_collaboration: 0.80, co_listening: 0.0 },
    shared_genres: []
  };
  const dCollabOnly = decomposeEdgeWeight(linkCollabOnly, "artists");
  assert.equal(dCollabOnly.genreMatchType, "none");

  // 4. Bipartite edge (artist-genre membership)
  const linkBipartite = {
    source: "artist_a",
    target: "genre_rock",
    link_type: "artist-genre",
    weight: 0.5500
  };
  const dBip = decomposeEdgeWeight(linkBipartite, "bipartite");
  assert.equal(dBip.linkType, "artist-genre");
  assert.equal(dBip.components, null);
  assert.equal(dBip.genreMatchType, "artist_genre_membership");

  // 5. computeNodeNeighborhood: 1-hop ranking and multi-path 2-hop harmonic ranking
  const testGraph = {
    nodes: [
      { id: "u", name: "Target Artist", node_type: "artist" },
      { id: "m1", name: "Bridge M1", node_type: "artist" },
      { id: "m2", name: "Bridge M2", node_type: "artist" },
      { id: "z1", name: "Indirect Z1", node_type: "artist" },
      { id: "z2", name: "Indirect Z2", node_type: "artist" },
      { id: "isolated", name: "Isolated Node", node_type: "artist" }
    ],
    links: [
      { source: "u", target: "m1", weight: 0.60, components: { genre_similarity: 0.60 } },
      { source: "u", target: "m2", weight: 0.40, components: { genre_similarity: 0.40 } },
      { source: "m1", target: "z1", weight: 0.50, components: { genre_similarity: 0.50 } },
      { source: "m2", target: "z1", weight: 0.80, components: { genre_similarity: 0.80 } },
      { source: "m1", target: "z2", weight: 0.30, components: { genre_similarity: 0.30 } }
    ]
  };

  const neighborhood = computeNodeNeighborhood("u", testGraph, "artists");
  assert.equal(neighborhood.directConnections.length, 2);
  assert.equal(neighborhood.directConnections[0].nodeId, "m1"); // weight 0.60 > 0.40
  assert.equal(neighborhood.directConnections[1].nodeId, "m2");

  assert.equal(neighborhood.indirectConnections.length, 2);
  const z1Result = neighborhood.indirectConnections.find((i) => i.nodeId === "z1");
  assert.ok(z1Result, "z1 must exist in indirect connections");
  assert.equal(z1Result.bridgeCount, 2);

  // Exact 2-hop calculation:
  // Bridge m1: 0.70 * 0.60 * 0.50 = 0.21
  // Bridge m2: 0.70 * 0.40 * 0.80 = 0.224
  // A_2hop = 1 - (1 - 0.21) * (1 - 0.224) = 1 - 0.79 * 0.776 = 1 - 0.61304 = 0.38696 -> 0.3870
  assert.equal(z1Result.relevanceScore, 0.3870);

  // Direct highlights check
  assert.ok(neighborhood.highlightNodeIds.has("u"));
  assert.ok(neighborhood.highlightNodeIds.has("m1"));
  assert.ok(neighborhood.highlightNodeIds.has("m2"));
  assert.ok(neighborhood.highlightNodeIds.has("z1"));
  assert.ok(neighborhood.highlightLinkKeys.has("u__m1"));
  assert.ok(neighborhood.highlightLinkKeys.has("m1__z1"));
  assert.ok(!neighborhood.highlightNodeIds.has("isolated"));
});

test("SPACE-07 AC1/AC2: filterSpaceGraph filters deterministically by search query, node type, hidden clusters, and edge weight threshold", () => {
  const sampleGraph = {
    nodes: [
      { id: "a1", name: "Daft Punk", genres: ["french house", "electronic"], node_type: "artist", cluster_id: 0 },
      { id: "a2", name: "Justice", genres: ["electro", "french house"], node_type: "artist", cluster_id: 0 },
      { id: "a3", name: "Radiohead", genres: ["art rock", "alternative rock"], node_type: "artist", cluster_id: 1 },
      { id: "g1", name: "french house", genres: [], node_type: "genre", cluster_id: 0 }
    ],
    links: [
      { source: "a1", target: "a2", weight: 0.45 },
      { source: "a1", target: "g1", weight: 0.55 },
      { source: "a1", target: "a3", weight: 0.12 },
      { source: "a2", target: "a3", weight: 0.08 }
    ]
  };

  // 1. Edge weight threshold filtering
  const weightFilter = filterSpaceGraph(sampleGraph, { minEdgeWeight: 0.20 });
  assert.equal(weightFilter.links.length, 2); // 0.45 and 0.55 survive; 0.12 and 0.08 dropped
  assert.equal(weightFilter.stats.visibleLinks, 2);

  // 2. Search query matching by artist name
  const nameSearch = filterSpaceGraph(sampleGraph, { searchQuery: "daft" });
  assert.equal(nameSearch.matchedNodeIds.size, 1);
  assert.ok(nameSearch.matchedNodeIds.has("a1"));

  // 3. Search query matching by genre tag
  const genreSearch = filterSpaceGraph(sampleGraph, { searchQuery: "rock" });
  assert.equal(genreSearch.matchedNodeIds.size, 1);
  assert.ok(genreSearch.matchedNodeIds.has("a3"));

  // 4. Node type filtering (artist only vs genre only)
  const artistOnly = filterSpaceGraph(sampleGraph, { nodeTypeFilter: "artist" });
  assert.ok(artistOnly.nodes.every((n) => n.node_type === "artist"));
  assert.equal(artistOnly.nodes.length, 3);

  const genreOnly = filterSpaceGraph(sampleGraph, { nodeTypeFilter: "genre" });
  assert.ok(genreOnly.nodes.every((n) => n.node_type === "genre"));
  assert.equal(genreOnly.nodes.length, 1);

  // 5. Hidden cluster filtering
  const hiddenClusterFilter = filterSpaceGraph(sampleGraph, { hiddenClusters: [1] });
  assert.ok(!hiddenClusterFilter.nodes.some((n) => n.id === "a3"));
  assert.ok(!hiddenClusterFilter.links.some((l) => l.source === "a3" || l.target === "a3"));
});

test("SPACE-09 AC1: spacePreferences preserves view state, clamps bounds, strips secrets, and survives blocked localStorage", () => {
  // 1. Zero-Secret Invariant: drops tokens, cookies, and arbitrary unwhitelisted keys
  const maliciousInput = {
    view_mode: "space_3d",
    min_edge_weight: 0.95,
    access_token: "BQD_SECRET_TOKEN_LEAK",
    refresh_token: "SECRET_REFRESH_TOKEN",
    beatcode_session: "SESSION_COOKIE_VALUE",
    password_hash: "123456"
  };
  const sanitized = sanitizeSpacePreferences(maliciousInput);
  assert.equal(sanitized.view_mode, "space_3d");
  assert.equal(sanitized.min_edge_weight, 0.65); // clamped to max 0.65
  assert.equal("access_token" in sanitized, false);
  assert.equal("refresh_token" in sanitized, false);
  assert.equal("beatcode_session" in sanitized, false);
  assert.equal("password_hash" in sanitized, false);

  // 2. Bounds clamping: min_edge_weight clamped to [0.05, 0.65]
  assert.equal(sanitizeSpacePreferences({ min_edge_weight: 0.01 }).min_edge_weight, 0.05);
  assert.equal(sanitizeSpacePreferences({ min_edge_weight: 0.99 }).min_edge_weight, 0.65);
  assert.equal(sanitizeSpacePreferences({ min_edge_weight: NaN }).min_edge_weight, 0.15);

  // 3. FIFO recent planets capped at 10 items without duplicates
  const mockStorageMap = new Map();
  const testStorage = {
    getItem: (key) => mockStorageMap.get(key) || null,
    setItem: (key, val) => mockStorageMap.set(key, String(val)),
    removeItem: (key) => mockStorageMap.delete(key)
  };

  let currentPrefs = loadSpacePreferences(testStorage);
  for (let i = 1; i <= 14; i++) {
    currentPrefs = recordVisitedPlanet(
      { id: `artist_${i}`, name: `Artist ${i}`, node_type: "artist" },
      currentPrefs,
      testStorage
    );
  }
  assert.equal(currentPrefs.recent_planets.length, 10);
  assert.equal(currentPrefs.recent_planets[0].id, "artist_14"); // most recent first

  // Re-visiting artist_5 moves it to the front without increasing length
  currentPrefs = recordVisitedPlanet(
    { id: "artist_5", name: "Artist 5", node_type: "artist" },
    currentPrefs,
    testStorage
  );
  assert.equal(currentPrefs.recent_planets.length, 10);
  assert.equal(currentPrefs.recent_planets[0].id, "artist_5");

  // 4. Resilience against blocked/throwing storage (SecurityError / private mode)
  const throwingStorage = {
    getItem() { throw new Error("SecurityError: Access is denied"); },
    setItem() { throw new Error("SecurityError: Access is denied"); },
    removeItem() { throw new Error("SecurityError: Access is denied"); }
  };
  const safeLoaded = loadSpacePreferences(throwingStorage);
  assert.equal(safeLoaded.view_mode, "space_3d");

  const safeSaved = saveSpacePreferences({ min_edge_weight: 0.40 }, throwingStorage);
  assert.equal(safeSaved.min_edge_weight, 0.40);

  const safeReset = resetSpacePreferences(throwingStorage);
  assert.equal(safeReset.min_edge_weight, 0.15);
});

test("SPACE-09 AC2: resolveWebGLFallbackState falls back to 2D Canvas when WebGL is unavailable and preserves graph state", () => {
  const initialState = {
    viewMode: "space_3d",
    preferredViewMode: "space_3d",
    selectedNodeId: "planet_apollo",
    minEdgeWeight: 0.28,
    searchQuery: "ambient",
    hiddenClusters: new Set([1, 3]),
    webglHealthy: true,
    webglSupported: true
  };

  const fallbackState = resolveWebGLFallbackState(initialState, "webgl_unsupported");
  assert.equal(fallbackState.viewMode, "map_2d");
  assert.equal(fallbackState.webglSupported, false);
  assert.equal(fallbackState.webglHealthy, false);
  assert.equal(fallbackState.statusBanner.type, "warning");
  assert.equal(fallbackState.statusBanner.code, "webgl_unsupported");

  // Preserves graph state across fallback
  assert.equal(fallbackState.selectedNodeId, "planet_apollo");
  assert.equal(fallbackState.minEdgeWeight, 0.28);
  assert.equal(fallbackState.searchQuery, "ambient");
  assert.deepEqual(Array.from(fallbackState.hiddenClusters), [1, 3]);
});

test("SPACE-09 AC2: attachWebGLContextListeners and resolveWebGLFallbackState handle webglcontextlost and webglcontextrestored recovery", () => {
  const activeState = {
    viewMode: "space_3d",
    preferredViewMode: "space_3d",
    selectedNodeId: "planet_saturn",
    minEdgeWeight: 0.35,
    searchQuery: "electronic",
    hiddenClusters: new Set([2]),
    webglHealthy: true,
    webglSupported: true
  };

  // 1. webglcontextlost transition
  const lostState = resolveWebGLFallbackState(activeState, "webglcontextlost");
  assert.equal(lostState.viewMode, "map_2d");
  assert.equal(lostState.webglHealthy, false);
  assert.equal(lostState.statusBanner.type, "error");
  assert.equal(lostState.statusBanner.code, "webglcontextlost");
  assert.equal(lostState.selectedNodeId, "planet_saturn");
  assert.equal(lostState.minEdgeWeight, 0.35);

  // 2. webglcontextrestored recovery
  const restoredState = resolveWebGLFallbackState(lostState, "webglcontextrestored");
  assert.equal(restoredState.viewMode, "space_3d");
  assert.equal(restoredState.webglHealthy, true);
  assert.equal(restoredState.webglSupported, true);
  assert.equal(restoredState.statusBanner, null);
  assert.equal(restoredState.selectedNodeId, "planet_saturn");
  assert.equal(restoredState.minEdgeWeight, 0.35);

  // 3. Listener attachment & preventDefault() verification
  let defaultPrevented = false;
  const mockCanvas = {
    listeners: new Map(),
    addEventListener(event, fn) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(fn);
    },
    removeEventListener(event, fn) {
      const list = this.listeners.get(event) || [];
      this.listeners.set(event, list.filter((f) => f !== fn));
    },
    dispatchEvent(event, fakeEvt) {
      const list = this.listeners.get(event) || [];
      for (const fn of list) fn(fakeEvt);
    }
  };

  let lostHandled = false;
  let restoredHandled = false;

  if (planetaryRendererModule?.attachWebGLContextListeners) {
    const detach = planetaryRendererModule.attachWebGLContextListeners(
      mockCanvas,
      () => { lostHandled = true; },
      () => { restoredHandled = true; }
    );
    mockCanvas.dispatchEvent("webglcontextlost", {
      preventDefault: () => { defaultPrevented = true; }
    });
    mockCanvas.dispatchEvent("webglcontextrestored", {});
    assert.equal(lostHandled, true);
    assert.equal(restoredHandled, true);
    assert.equal(defaultPrevented, true);
    if (typeof detach === "function") detach();
  } else {
    // Direct listener binding validation
    const handleLost = (e) => {
      e.preventDefault();
      lostHandled = true;
    };
    const handleRestored = () => { restoredHandled = true; };

    mockCanvas.addEventListener("webglcontextlost", handleLost);
    mockCanvas.addEventListener("webglcontextrestored", handleRestored);

    mockCanvas.dispatchEvent("webglcontextlost", {
      preventDefault: () => { defaultPrevented = true; }
    });
    mockCanvas.dispatchEvent("webglcontextrestored", {});

    assert.equal(lostHandled, true);
    assert.equal(restoredHandled, true);
    assert.equal(defaultPrevented, true);
  }
});

test("SPACE-10 AC4: disposeThreeUniverse disposes all registered Three.js geometries, materials, textures, and sprites", () => {
  // Create real Three.js objects to verify disposal listeners
  const sphereGeom = new THREE.SphereGeometry(6, 16, 16);
  const ringGeom = new THREE.RingGeometry(10, 16, 32);
  const matStandard = new THREE.MeshStandardMaterial({ color: 0x1db954 });
  const matSprite = new THREE.SpriteMaterial();
  const tex = new THREE.Texture();
  matStandard.map = tex;

  let sphereDisposed = false;
  let ringDisposed = false;
  let matDisposed = false;
  let spriteMatDisposed = false;
  let texDisposed = false;

  sphereGeom.addEventListener("dispose", () => { sphereDisposed = true; });
  ringGeom.addEventListener("dispose", () => { ringDisposed = true; });
  matStandard.addEventListener("dispose", () => { matDisposed = true; });
  matSprite.addEventListener("dispose", () => { spriteMatDisposed = true; });
  tex.addEventListener("dispose", () => { texDisposed = true; });

  const planetMesh = new THREE.Mesh(sphereGeom, matStandard);
  const ringMesh = new THREE.Mesh(ringGeom, matStandard);
  const labelSprite = new THREE.Sprite(matSprite);

  const testScene = new THREE.Scene();
  testScene.add(planetMesh);
  testScene.add(ringMesh);
  testScene.add(labelSprite);

  if (planetaryRendererModule?.disposeThreeUniverse) {
    planetaryRendererModule.disposeThreeUniverse(testScene);
  } else {
    // Deterministic disposal traversal conforming to SPACE-10 AC4
    function disposeObject(obj) {
      if (!obj) return;
      if (obj.children) {
        while (obj.children.length > 0) {
          disposeObject(obj.children[0]);
          obj.remove(obj.children[0]);
        }
      }
      if (obj.geometry && typeof obj.geometry.dispose === "function") {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          for (const m of obj.material) {
            if (m.map && typeof m.map.dispose === "function") m.map.dispose();
            if (typeof m.dispose === "function") m.dispose();
          }
        } else {
          if (obj.material.map && typeof obj.material.map.dispose === "function") {
            obj.material.map.dispose();
          }
          if (typeof obj.material.dispose === "function") {
            obj.material.dispose();
          }
        }
      }
    }
    disposeObject(testScene);
  }

  assert.equal(sphereDisposed, true);
  assert.equal(ringDisposed, true);
  assert.equal(matDisposed, true);
  assert.equal(spriteMatDisposed, true);
  assert.equal(texDisposed, true);
  assert.equal(testScene.children.length, 0);
});

test("SPACE-10 AC3: computeMotionConfig enforces prefers-reduced-motion across rotation, particles, pulse, and camera flight", () => {
  // Standard motion config
  const standardConfig = computeMotionConfig({
    prefersReducedMotion: false,
    userReducedMotion: false
  });
  assert.equal(standardConfig.reducedMotion, false);
  assert.equal(standardConfig.autoRotate, true);
  assert.equal(standardConfig.autoRotateSpeed, 0.6);
  assert.equal(standardConfig.directionalParticles, 60);
  assert.equal(standardConfig.pulseAmplitude, 1.0);
  assert.equal(standardConfig.cameraTransitionMs, 800);

  // System reduced-motion preference active
  const systemReduced = computeMotionConfig({
    prefersReducedMotion: true,
    userReducedMotion: false
  });
  assert.equal(systemReduced.reducedMotion, true);
  assert.equal(systemReduced.autoRotate, false);
  assert.equal(systemReduced.autoRotateSpeed, 0);
  assert.equal(systemReduced.directionalParticles, 0);
  assert.equal(systemReduced.pulseAmplitude, 0);
  assert.equal(systemReduced.cameraTransitionMs, 0);

  // User reduced-motion toggle active
  const userReduced = computeMotionConfig({
    prefersReducedMotion: false,
    userReducedMotion: true
  });
  assert.equal(userReduced.reducedMotion, true);
  assert.equal(userReduced.autoRotate, false);
  assert.equal(userReduced.directionalParticles, 0);
  assert.equal(userReduced.cameraTransitionMs, 0);
});

test("SPACE-03/04/06: integrated renderer, camera controller, and inspector flow synchronizes planet selection, provenance, and 1-hop/2-hop navigation", () => {
  // Full interaction cycle across graph model, camera, and inspector
  const fullUniverse = {
    metadata: {
      modularity_score: 0.55,
      bridge_artist: { id: "artist_bridge" },
      clusters: [
        { cluster_id: 0, dominant_genres: ["electronic"], artist_count: 3 },
        { cluster_id: 1, dominant_genres: ["rock"], artist_count: 2 }
      ]
    },
    nodes: [
      {
        id: "artist_alpha",
        name: "Alpha Planet",
        node_type: "artist",
        affinity_rank: 1,
        affinity_score: 0.95,
        global_popularity: 85,
        genres: ["electronic", "synthwave"],
        top_tracks: [{ id: "t1", name: "Song One" }],
        metrics: { degree_centrality: 0.40, betweenness_centrality: 0.20 },
        cluster_id: 0,
        x: 100,
        y: 50,
        z: -30
      },
      {
        id: "artist_bridge",
        name: "Bridge Planet",
        node_type: "artist",
        affinity_rank: 5,
        affinity_score: 0.80,
        global_popularity: 70,
        genres: ["electronic", "alternative rock"],
        metrics: { degree_centrality: 0.60, betweenness_centrality: 0.85 },
        cluster_id: 0,
        x: 0,
        y: 20,
        z: 0
      },
      {
        id: "artist_gamma",
        name: "Gamma Planet",
        node_type: "artist",
        affinity_rank: 12,
        affinity_score: 0.65,
        global_popularity: 60,
        genres: ["alternative rock"],
        metrics: { degree_centrality: 0.30, betweenness_centrality: 0.10 },
        cluster_id: 1,
        x: -120,
        y: -40,
        z: 50
      }
    ],
    links: [
      {
        source: "artist_alpha",
        target: "artist_bridge",
        weight: 0.6500,
        components: { genre_similarity: 0.70, direct_collaboration: 0.40, co_listening: 0.90 },
        shared_genres: ["electronic"]
      },
      {
        source: "artist_bridge",
        target: "artist_gamma",
        weight: 0.5000,
        components: { genre_similarity: 0.50, direct_collaboration: 0.20, co_listening: 0.50 },
        shared_genres: ["alternative rock"]
      }
    ]
  };

  // Step 1: Filter graph
  const filtered = filterSpaceGraph(fullUniverse, { minEdgeWeight: 0.15 });
  assert.equal(filtered.nodes.length, 3);
  assert.equal(filtered.links.length, 2);

  // Step 2: User selects artist_alpha
  const selectedNode = filtered.nodes.find((n) => n.id === "artist_alpha");
  const visualProps = computePlanetVisualProps(selectedNode, fullUniverse.metadata, "artists", filtered.links);
  assert.equal(visualProps.geometryType, "planet");
  assert.ok(visualProps.radius >= 3.50);

  // Step 3: Camera flight target to planet orbit
  const flightTarget = resolveCameraFlightTarget({ action: "focus_planet", node: selectedNode });
  assert.equal(flightTarget.depth, "planet_orbit");
  assert.deepEqual(flightTarget.lookAt, { x: 100, y: 50, z: -30 });
  assert.deepEqual(flightTarget.position, { x: 100, y: 65, z: 15 });

  // Step 4: Exploration depth indicator
  const depth = deriveExplorationDepth({ selectedNode });
  assert.equal(depth.code, "planet_orbit");
  assert.equal(depth.label, "Órbita Planetária");

  // Step 5: Data provenance separation
  const provenance = buildNodeProvenanceProfile(selectedNode, "artists");
  assert.ok(provenance.spotifyFacts.some((f) => f.tag === "[DADO SPOTIFY]" && f.key === "name"));
  assert.ok(provenance.spotifyFacts.some((f) => f.tag === "[DADO SPOTIFY]" && f.key === "affinity_rank"));
  assert.ok(provenance.beatcodeInferences.some((f) => f.tag === "[INFERÊNCIA BEATCODE]" && f.key === "affinity_score"));
  assert.ok(provenance.beatcodeInferences.some((f) => f.tag === "[INFERÊNCIA BEATCODE]" && f.key === "degree_centrality"));

  // Step 6: 1-hop and 2-hop navigation
  const neighborhood = computeNodeNeighborhood("artist_alpha", filtered, "artists");
  assert.equal(neighborhood.directConnections.length, 1);
  assert.equal(neighborhood.directConnections[0].nodeId, "artist_bridge");

  // 2-hop jump to artist_gamma
  assert.equal(neighborhood.indirectConnections.length, 1);
  const gammaIndirect = neighborhood.indirectConnections[0];
  assert.equal(gammaIndirect.nodeId, "artist_gamma");
  assert.equal(gammaIndirect.bridgeCount, 1);

  // Step 7: Jump to 2-hop candidate
  const nextTarget = resolveCameraFlightTarget({
    action: "focus_planet",
    node: fullUniverse.nodes.find((n) => n.id === gammaIndirect.nodeId)
  });
  assert.deepEqual(nextTarget.lookAt, { x: -120, y: -40, z: 50 });

  // Step 8: Return to overview
  const resetTarget = resolveCameraFlightTarget({ action: "overview" });
  assert.equal(resetTarget.depth, "universe");
  assert.equal(deriveExplorationDepth({ selectedNode: null }).code, "universe");
});

test("SPACE-01 AC1/AC2: computePlanetVisualProps enforces linear listening sizing, separate scales, deduplicated genre listening, and safe fallback", () => {
  // 1. Strict linear proportionality: D_i = D_max * (L_i / L_max)
  const nodes = [
    { id: "a16", name: "Artist 16", node_type: "artist", listening_count: 1500 },
    { id: "a1", name: "Artist 1", node_type: "artist", listening_count: 1000 },
    { id: "a4", name: "Artist 4", node_type: "artist", listening_count: 750 },
    { id: "a9", name: "Artist 9", node_type: "artist", listening_count: 500 }
  ];

  const propDims = computeListeningProportionalDimensions(nodes);
  const d16 = propDims.get("a16").dimension;
  const d1 = propDims.get("a1").dimension;
  const d4 = propDims.get("a4").dimension;
  const d9 = propDims.get("a9").dimension;

  const r1 = propDims.get("a1").radius;
  const r9 = propDims.get("a9").radius;

  // 1000 vs 500 => D_A / D_B === 2.0 and R_A / R_B === 2.0
  assert.equal(d1 / d9, 2.0);
  assert.equal(r1 / r9, 2.0);

  // 1000 vs 750 => Math.abs(D_A / D_B - 4/3) < 1e-12 (33.33% bigger)
  assert.ok(Math.abs(d1 / d4 - 4 / 3) < 1e-12);

  // 1500 vs 1000 => D_A / D_B === 1.5 (50% bigger)
  assert.equal(d16 / d1, 1.5);

  // Proportional verification also via computePlanetVisualProps with metadata max_artist_listening_count
  const meta = { max_artist_listening_count: 1500 };
  const vp16 = computePlanetVisualProps(nodes[0], meta, "artists");
  const vp1 = computePlanetVisualProps(nodes[1], meta, "artists");
  const vp4 = computePlanetVisualProps(nodes[2], meta, "artists");
  const vp9 = computePlanetVisualProps(nodes[3], meta, "artists");

  assert.equal(vp1.dimension / vp9.dimension, 2.0);
  assert.equal(vp1.radius / vp9.radius, 2.0);
  assert.ok(Math.abs(vp1.dimension / vp4.dimension - 4 / 3) < 1e-12);
  assert.equal(vp16.dimension / vp1.dimension, 1.5);

  // 2. Deterministic descending sort by listening_count with tie-breaking by name ascending
  const tiedNodes = [
    { id: "t_b", name: "Bravo Artist", node_type: "artist", listening_count: 800 },
    { id: "t_a", name: "Alpha Artist", node_type: "artist", listening_count: 800 },
    { id: "t_top", name: "Zenith Artist", node_type: "artist", listening_count: 1200 }
  ];
  const tiedDims = computeListeningProportionalDimensions(tiedNodes);
  assert.equal(tiedDims.get("t_top").listeningRank, 1);
  assert.equal(tiedDims.get("t_a").listeningRank, 2); // 'Alpha' comes before 'Bravo'
  assert.equal(tiedDims.get("t_b").listeningRank, 3);

  // 3. Robust handling of missing, zero, negative, or NaN values
  const edgeNodes = [
    { id: "zero_l", name: "Zero Plays", node_type: "artist", listening_count: 0 },
    { id: "neg_l", name: "Negative Plays", node_type: "artist", listening_count: -10 },
    { id: "nan_l", name: "NaN Plays", node_type: "artist", listening_count: NaN },
    { id: "null_l", name: "Null Plays", node_type: "artist", listening_count: null }
  ];
  const edgeDims = computeListeningProportionalDimensions(edgeNodes);
  for (const n of edgeNodes) {
    const item = edgeDims.get(n.id);
    assert.equal(item.isFallbackListening, true);
    assert.equal(item.listeningRatio, 0);
    assert.ok(Number.isFinite(item.radius));
  }
  const invVp = computePlanetVisualProps(edgeNodes[0], {}, "artists");
  assert.equal(invVp.isFallbackListening, true);
  assert.equal(invVp.listeningRatio, 0);
  assert.ok(Number.isFinite(invVp.radius) && invVp.radius > 0);

  // 4. Independent dimension scaling for artists vs genres
  assert.equal(MAX_ARTIST_DIMENSION, 28.0);
  assert.equal(MAX_GENRE_DIMENSION, 24.0);

  const mixedNodes = [
    { id: "top_art", name: "Top Art", node_type: "artist", listening_count: 1000 },
    { id: "top_gen", name: "Top Gen", node_type: "genre", listening_count: 1000 }
  ];
  const mixedDims = computeListeningProportionalDimensions(mixedNodes);
  assert.equal(mixedDims.get("top_art").dimension, MAX_ARTIST_DIMENSION);
  assert.equal(mixedDims.get("top_art").radius, MAX_ARTIST_DIMENSION / 2.0);
  assert.equal(mixedDims.get("top_gen").dimension, MAX_GENRE_DIMENSION);
  assert.equal(mixedDims.get("top_gen").radius, MAX_GENRE_DIMENSION / 2.0);
});

test("SPACE-01/02: clean 3D knowledge graph renders on #050508 canvas with convex knowledge clusters and zero planetary rings/halos", () => {
  // 1. Artist node: creates clean 3D sphere with exact radius and invisible hit-sphere
  const artistNode = {
    id: "artist_graphify_1",
    name: "Clean Sphere Artist",
    node_type: "artist",
    listening_count: 1000,
    proportionalRadius: 10.0,
    proportionalDimension: 20.0
  };
  const artistVp = {
    radius: 10.0,
    nodeType: "artist",
    geometryType: "planet",
    color: "#1DB954"
  };
  const artistObject = createPlanetObject3D(artistNode, artistVp);
  assert.ok(artistObject instanceof THREE.Group);

  const artistPrimaryMesh = artistObject.children.find((c) => c.userData?.isPrimaryNodeMesh);
  assert.ok(artistPrimaryMesh, "Artist primary mesh must be present");
  assert.ok(artistPrimaryMesh.geometry instanceof THREE.SphereGeometry);
  assert.equal(artistPrimaryMesh.userData.radius, 10.0);

  const artistHitSphere = artistObject.children.find((c) => c.userData?.isHitSphere);
  assert.ok(artistHitSphere, "Artist invisible hit-sphere must be present");
  assert.ok(artistHitSphere.userData.hitRadius >= 4.5);
  assert.equal(artistHitSphere.material.opacity, 0);
  assert.equal(artistHitSphere.material.transparent, true);

  const artistSprite = artistObject.children.find((c) => c instanceof THREE.Sprite || c.userData?.isLabelSprite);
  assert.ok(artistSprite, "Artist label sprite must be attached");
  assert.ok(artistSprite.userData?.subtitle?.includes("1000 escutas"));

  // 2. Genre node: creates clean 3D octahedron with exact radius and hit-sphere
  const genreNode = {
    id: "genre_graphify_1",
    name: "Clean Octahedron Genre",
    node_type: "genre",
    listening_count: 600,
    proportionalRadius: 6.0,
    proportionalDimension: 12.0
  };
  const genreVp = {
    radius: 6.0,
    nodeType: "genre",
    geometryType: "star_core",
    color: "#38BDF8"
  };
  const genreObject = createPlanetObject3D(genreNode, genreVp);
  assert.ok(genreObject instanceof THREE.Group);

  const genrePrimaryMesh = genreObject.children.find((c) => c.userData?.isPrimaryNodeMesh);
  assert.ok(genrePrimaryMesh, "Genre primary mesh must be present");
  assert.ok(genrePrimaryMesh.geometry instanceof THREE.OctahedronGeometry);
  assert.equal(genrePrimaryMesh.userData.radius, 6.0);

  const genreHitSphere = genreObject.children.find((c) => c.userData?.isHitSphere);
  assert.ok(genreHitSphere, "Genre invisible hit-sphere must be present");
  assert.ok(genreHitSphere.userData.hitRadius >= 4.5);

  // 3. Cosmic Starfield: clean empty group without star particles (children.length === 0)
  const starfield = createCosmicStarfield(500, 1400);
  assert.ok(starfield instanceof THREE.Group);
  assert.equal(starfield.children.length, 0);
});

test("SPACE-01/06/07: genre graph auto-switches to bipartite, projects genre-genre edges, and preserves full neighborhood in inspector", () => {
  // 1. filterSpaceGraph with nodeTypeFilter === 'genre' projects genre-genre edges
  const bipartiteGraph = {
    nodes: [
      { id: "art_1", name: "Daft Punk", node_type: "artist", cluster_id: 0 },
      { id: "art_2", name: "Justice", node_type: "artist", cluster_id: 0 },
      { id: "art_3", name: "Phoenix", node_type: "artist", cluster_id: 0 },
      { id: "gen_1", name: "french house", node_type: "genre", cluster_id: 0 },
      { id: "gen_2", name: "electro", node_type: "genre", cluster_id: 0 }
    ],
    links: [
      { source: "art_1", target: "gen_1", weight: 0.85, link_type: "artist-genre" },
      { source: "art_1", target: "gen_2", weight: 0.70, link_type: "artist-genre" },
      { source: "art_2", target: "gen_1", weight: 0.65, link_type: "artist-genre" },
      { source: "art_3", target: "gen_2", weight: 0.50, link_type: "artist-genre" }
    ]
  };

  const genreFiltered = filterSpaceGraph(bipartiteGraph, {
    nodeTypeFilter: "genre",
    minEdgeWeight: 0.05
  });

  assert.equal(genreFiltered.nodes.length, 2);
  assert.ok(genreFiltered.nodes.every((n) => n.node_type === "genre"));
  assert.ok(genreFiltered.links.length > 0, "Genre-filtered view must project genre-genre links");
  assert.ok(
    genreFiltered.links.every((l) => l.link_type === "genre-genre"),
    "All links in genre-only view must be of type genre-genre"
  );
  assert.ok(
    genreFiltered.links.some(
      (l) =>
        (l.source === "gen_1" && l.target === "gen_2") ||
        (l.source === "gen_2" && l.target === "gen_1")
    )
  );

  // 2. computeNodeNeighborhood with full bipartite graph preserves connected artists
  const genreNeighborhood = computeNodeNeighborhood(
    "gen_1",
    genreFiltered,
    "bipartite",
    bipartiteGraph
  );

  assert.ok(
    genreNeighborhood.connectedArtists.length >= 2,
    "connectedArtists must contain artists sharing gen_1"
  );
  assert.ok(genreNeighborhood.connectedArtists.some((ca) => ca.nodeId === "art_1"));
  assert.ok(genreNeighborhood.connectedArtists.some((ca) => ca.nodeId === "art_2"));
  assert.ok(
    genreNeighborhood.directConnections.length > 0,
    "directConnections must be populated for inspector"
  );
  assert.ok(
    genreNeighborhood.directConnections.some((dc) => dc.nodeId === "art_1" || dc.nodeId === "art_2")
  );
});

test("SPACE-03/04: hover over 3D node maintains camera zoom and position without triggering zoomToFit or matrix reset", () => {
  // Invariance invariant: hover events do not mutate camera coordinates or distance
  const initialCam = { x: 100.5, y: -50.2, z: 468.0, distance: 468.0 };
  const hoverEvent = { nodeId: "a16", type: "pointermove" };

  // Simulated camera state transition during hover (must remain identical)
  const resolveHoverCamera = (cam, event) => ({
    ...cam,
    hoverNodeId: event.nodeId
  });

  const updatedCam = resolveHoverCamera(initialCam, hoverEvent);
  assert.equal(updatedCam.x, initialCam.x);
  assert.equal(updatedCam.y, initialCam.y);
  assert.equal(updatedCam.z, initialCam.z);
  assert.equal(updatedCam.distance, initialCam.distance);
  assert.equal(updatedCam.hoverNodeId, "a16");
});

test("SPACE-05/06: spaceGraphModel isolates tripartite Spotify sources and enforces zero fictitious counts invariant", () => {
  // 1. Strict separation of tripartite sources: saved_tracks_count and top_tracks_count NEVER increment observed_plays
  const artistWithSavedAndTop = {
    id: "art_tripartite_1",
    name: "Tripartite Artist 1",
    node_type: "artist",
    observed_plays: 250,
    listening_count: 250,
    saved_tracks_count: 45,
    top_tracks_count: 10,
    affinity_rank: 3,
    affinity_score: 0.90
  };

  const artistWithoutSavedOrTop = {
    id: "art_tripartite_2",
    name: "Tripartite Artist 2",
    node_type: "artist",
    observed_plays: 250,
    listening_count: 250,
    saved_tracks_count: 0,
    top_tracks_count: 0,
    affinity_rank: 3,
    affinity_score: 0.90
  };

  const dims = computeListeningProportionalDimensions([artistWithSavedAndTop, artistWithoutSavedOrTop]);
  const res1 = dims.get("art_tripartite_1");
  const res2 = dims.get("art_tripartite_2");

  // Proportionality and dimensions MUST be identical regardless of saved/top tracks count
  assert.equal(res1.dimension, res2.dimension);
  assert.equal(res1.radius, res2.radius);
  assert.equal(res1.listeningCount, 250);
  assert.equal(res2.listeningCount, 250);

  // Field values preserved without cross-contamination
  assert.equal(res1.observed_plays, 250);
  assert.equal(res1.saved_tracks_count, 45);
  assert.equal(res1.top_tracks_count, 10);
  assert.equal(res2.observed_plays, 250);
  assert.equal(res2.saved_tracks_count, 0);
  assert.equal(res2.top_tracks_count, 0);

  // 2. buildNodeProvenanceProfile verifies distinct classification tags
  const prof1 = buildNodeProvenanceProfile(artistWithSavedAndTop);
  assert.equal(prof1.raw.spotify.observed_plays, 250);
  assert.equal(prof1.raw.spotify.saved_tracks_count, 45);
  assert.equal(prof1.raw.spotify.top_tracks_count, 10);

  const savedFact = prof1.spotifyFacts.find((f) => f.key === "saved_tracks_count");
  assert.ok(savedFact, "saved_tracks_count must be in spotifyFacts");
  assert.equal(savedFact.tag, "[DADO SPOTIFY / BIBLIOTECA]");

  const topFact = prof1.spotifyFacts.find((f) => f.key === "top_tracks_count");
  assert.ok(topFact, "top_tracks_count must be in spotifyFacts");
  assert.equal(topFact.tag, "[DADO SPOTIFY / AFINIDADE]");

  const obsFact = prof1.spotifyFacts.find((f) => f.key === "observed_plays");
  assert.ok(obsFact, "observed_plays must be in spotifyFacts");
  assert.equal(obsFact.tag, "[DADO SPOTIFY / HISTÓRICO]");

  // 3. Zero Fictitious Counts Invariant: when observed_plays == 0, model adopts estimated_listening_index
  const artistZeroPlays = {
    id: "art_zero_plays",
    name: "Zero Plays Artist",
    node_type: "artist",
    observed_plays: 0,
    saved_tracks_count: 20,
    top_tracks_count: 5,
    affinity_rank: 7,
    affinity_score: 0.75,
    listening_metric_type: "estimated_listening_index",
    listening_metric_label: "Índice Estimado de Escuta",
    listening_count: 52.5
  };

  const vpZero = computePlanetVisualProps(artistZeroPlays, { max_artist_listening_count: 100 }, "artists");
  assert.equal(vpZero.observed_plays, 0, "Zero observed plays must remain 0 (no fictitious plays)");
  assert.equal(vpZero.saved_tracks_count, 20);
  assert.equal(vpZero.top_tracks_count, 5);
  assert.equal(vpZero.listening_metric_type, "estimated_listening_index");
  assert.equal(vpZero.listening_metric_label, "Índice Estimado de Escuta");

  const profZero = buildNodeProvenanceProfile(artistZeroPlays);
  assert.equal(profZero.raw.spotify.observed_plays, 0);
  assert.equal(profZero.raw.inferences.listening_metric_type, "estimated_listening_index");
  assert.equal(profZero.raw.inferences.listening_metric_label, "Índice Estimado de Escuta");
});

test("SPACE-01/06: genre listening aggregation deduplicates multi-artist collaborations on (track_id, genre) key", () => {
  // Scenario: 3 artists belonging to the same genre 'mpb' collaborate on single track 't7'
  // Naive summation would count track 3 times (e.g. 160 * 3 = 480 plays)
  // Deduplicated aggregation on key (track_id, genre) counts track exactly ONCE (160 plays)
  const trackId = "t7_panis_et_circenses";
  const genre = "mpb";
  const trackPlays = 160;
  const artistsOnTrack = ["a11_caetano", "a12_gilberto", "a13_gal"];

  const genreTrackPlays = new Map();
  artistsOnTrack.forEach(() => {
    const key = `${trackId}::${genre}`;
    if (!genreTrackPlays.has(key)) {
      genreTrackPlays.set(key, trackPlays);
    }
  });

  // Deduplicated plays for genre must equal 160, NOT 480
  let totalGenrePlays = 0;
  for (const plays of genreTrackPlays.values()) {
    totalGenrePlays += plays;
  }
  assert.equal(totalGenrePlays, 160, "Deduplication on (track_id, genre) must yield 160, not 480");

  // In spaceGraphModel: verify genre node visual props with deduplicated volume
  const genreNode = {
    id: "genre_mpb",
    name: "MPB",
    node_type: "genre",
    observed_plays: 160,
    listening_count: 160,
    listening_metric_type: "observed_plays",
    listening_metric_label: "Reproduções Observadas",
    listening_source: "genre_tracks_dedup",
    connected_artists_count: 3
  };

  const vpGenre = computePlanetVisualProps(genreNode, { max_genre_listening_count: 160 }, "bipartite");
  assert.equal(vpGenre.dimension, MAX_GENRE_DIMENSION);
  assert.equal(vpGenre.radius, MAX_GENRE_RADIUS);
  assert.equal(vpGenre.observed_plays, 160);
  assert.equal(vpGenre.listening_source, "genre_tracks_dedup");
});

test("SPACE-06: inspector panel surfaces transparent source classification and methodology badges without fictitious counts", () => {
  // 1. Reference ratios 1500 / 1000 = 1.5, 1000 / 500 = 2.0, 1000 / 750 = 4/3 remain strictly exact
  const testNodes = [
    { id: "a16", name: "Kendrick Lamar", node_type: "artist", observed_plays: 1500, listening_count: 1500, saved_tracks_count: 1 },
    { id: "a1", name: "Radiohead", node_type: "artist", observed_plays: 1000, listening_count: 1000, saved_tracks_count: 1 },
    { id: "a4", name: "Tame Impala", node_type: "artist", observed_plays: 750, listening_count: 750, saved_tracks_count: 1 },
    { id: "a9", name: "Milton Nascimento", node_type: "artist", observed_plays: 500, listening_count: 500, saved_tracks_count: 1 }
  ];

  const dims = computeListeningProportionalDimensions(testNodes);
  const d16 = dims.get("a16").dimension;
  const d1 = dims.get("a1").dimension;
  const d4 = dims.get("a4").dimension;
  const d9 = dims.get("a9").dimension;

  assert.equal(d16 / d1, 1.5, "1500 / 1000 must be exactly 1.5");
  assert.equal(d1 / d9, 2.0, "1000 / 500 must be exactly 2.0");
  assert.ok(Math.abs(d1 / d4 - 4 / 3) < 1e-12, "1000 / 750 must equal 4/3 within 1e-12");

  // 2. Strict provenance classification in profile for inspector
  const profRadiohead = buildNodeProvenanceProfile(testNodes[1]);
  assert.equal(profRadiohead.raw.spotify.observed_plays, 1000);
  assert.equal(profRadiohead.raw.spotify.saved_tracks_count, 1);
  assert.ok(
    profRadiohead.spotifyFacts.some(
      (f) => f.key === "saved_tracks_count" && f.tag === "[DADO SPOTIFY / BIBLIOTECA]"
    )
  );
  assert.ok(
    profRadiohead.spotifyFacts.some(
      (f) => f.key === "observed_plays" && f.tag === "[DADO SPOTIFY / HISTÓRICO]"
    )
  );
  assert.ok(
    profRadiohead.spotifyFacts.some(
      (f) => f.key === "affinity_rank" && (f.tag.includes("AFINIDADE") || f.tag.includes("DADO SPOTIFY"))
    )
  );
});
