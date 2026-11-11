/**
 * BeatCode Space — Pure Spatial Graph Domain Model & Mathematical Engine
 *
 * Implements deterministic astrophysical mapping, 4-attribute edge explainability,
 * 1-hop and 2-hop harmonic relevance ranking, provenance separation, camera flights,
 * motion accessibility, WebGL state transitions, linear listening proportional dimensions,
 * projected genre-genre connectivity, and complete neighborhood preservation.
 *
 * Zero DOM or Three.js dependencies (100% testable via node --test).
 */

export const DEFAULT_COLOR = "#1DB954";
export const DEFAULT_MIN_EDGE_WEIGHT = 0.15;

export const MAX_ARTIST_DIMENSION = 28.0;
export const MAX_ARTIST_RADIUS = 14.0;
export const MAX_GENRE_DIMENSION = 24.0;
export const MAX_GENRE_RADIUS = 12.0;

export const CLUSTER_PALETTE = [
  "#10B981", // emerald
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#6366F1", // indigo
  "#84CC16", // lime
  "#06B6D4"  // cyan
];

/**
 * Deterministic string hash (FNV-1a 32-bit).
 * Returns a stable unsigned 32-bit integer.
 */
export function hashString(str) {
  let hash = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Escapes HTML special characters to prevent XSS in 3D tooltips and sprite labels.
 */
export function escapeHtml(input) {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitizes node color with hex validation fallback.
 */
export function sanitizeNodeColor(color) {
  const hexPattern = /^#[0-9a-fA-F]{3,8}$/;
  if (typeof color === "string" && hexPattern.test(color.trim())) {
    return color.trim();
  }
  return DEFAULT_COLOR;
}

/**
 * Sanitizes node name with non-empty string fallback.
 */
export function sanitizeNodeName(name) {
  if (typeof name === "string" && name.trim().length > 0) {
    return name.trim();
  }
  return "Desconhecido";
}

/**
 * Computes strictly proportional linear dimensions based on listening counts:
 * D_i = D_max * (L_i / L_max), R_i = (D_max / 2) * (L_i / L_max)
 *
 * Guarantees mathematically without arbitrary clamps:
 * L_A = 1000, L_B = 500 => D_A / D_B = R_A / R_B = 2.0
 * L_A = 1000, L_B = 750 => D_A / D_B = R_A / R_B = 4 / 3 = 1.3333333333333333
 * L_A = 1500, L_B = 1000 => D_A / D_B = R_A / R_B = 1.5
 *
 * @param {Array} nodes List of graph nodes
 * @param {Object} options Configuration options (maxArtistListeningCount, maxGenreListeningCount, etc.)
 * @returns {Map<string, Object>} Map of nodeId -> ProportionalDimensionItem (also array-like with .nodes)
 */
export function computeListeningProportionalDimensions(nodes = [], options = {}) {
  const nodeList = Array.isArray(nodes) ? nodes : [];

  const artists = [];
  const genres = [];

  for (const n of nodeList) {
    if (!n || typeof n !== "object") continue;
    const nodeType = n.node_type === "genre" ? "genre" : "artist";
    if (nodeType === "genre") {
      genres.push(n);
    } else {
      artists.push(n);
    }
  }

  function processGroup(group, defaultDMax, explicitMax) {
    const D_max = defaultDMax;
    const R_max = D_max / 2.0;

    const items = group.map((node) => {
      const rawL = node.listening_count ?? node.play_count;
      const isValid = rawL !== null && rawL !== undefined && Number.isFinite(Number(rawL)) && Number(rawL) > 0;
      const listeningCount = isValid ? Number(rawL) : 0;
      const name = sanitizeNodeName(node.name);
      return {
        node,
        id: node.id,
        nodeId: node.id,
        name,
        nodeType: node.node_type === "genre" ? "genre" : "artist",
        listeningCount,
        hasValidListening: isValid
      };
    });

    // Deterministic sort: listeningCount desc, name asc
    items.sort((a, b) => {
      if (b.listeningCount !== a.listeningCount) {
        return b.listeningCount - a.listeningCount;
      }
      return a.name.localeCompare(b.name);
    });

    let L_max = Number.isFinite(Number(explicitMax)) && Number(explicitMax) > 0
      ? Number(explicitMax)
      : 0;

    if (L_max === 0) {
      for (const item of items) {
        if (item.listeningCount > L_max) {
          L_max = item.listeningCount;
        }
      }
    }

    const results = [];
    for (let rankIdx = 0; rankIdx < items.length; rankIdx++) {
      const item = items[rankIdx];
      const listeningRank = rankIdx + 1;

      let listeningRatio = 0;
      let dimension = 0;
      let radius = 0;
      let isFallbackListening = true;

      if (item.hasValidListening && item.listeningCount > 0 && L_max > 0) {
        listeningRatio = item.listeningCount / L_max;
        dimension = (D_max * item.listeningCount) / L_max;
        radius = dimension / 2.0;
        isFallbackListening = false;
      }

      const hitRadius = Math.max(radius, 4.5);

      const res = {
        id: item.id,
        nodeId: item.nodeId,
        node: item.node,
        name: item.name,
        nodeType: item.nodeType,
        listeningCount: item.listeningCount,
        listeningRank,
        listeningRatio,
        dimension,
        radius,
        hitRadius,
        isFallbackListening
      };

      // Enable dual destructuring [id, res] and direct property access
      res[Symbol.iterator] = function*() {
        yield res.id;
        yield res;
      };

      if (item.node && typeof item.node === "object") {
        item.node.listeningCount = item.listeningCount;
        item.node.listeningRank = listeningRank;
        item.node.listeningRatio = listeningRatio;
        item.node.proportionalDimension = dimension;
        item.node.proportionalRadius = radius;
        item.node.hitRadius = hitRadius;
        item.node.isFallbackListening = isFallbackListening;
      }

      results.push(res);
    }

    return results;
  }

  const artistResults = processGroup(
    artists,
    MAX_ARTIST_DIMENSION,
    options.maxArtistListeningCount ?? options.maxListeningCount
  );

  const genreResults = processGroup(
    genres,
    MAX_GENRE_DIMENSION,
    options.maxGenreListeningCount ?? options.maxListeningCount
  );

  const allResults = [...artistResults, ...genreResults];

  const resultMap = new Map();
  for (let i = 0; i < allResults.length; i++) {
    const item = allResults[i];
    resultMap.set(item.id, item);
    resultMap[i] = item;
  }

  resultMap.length = allResults.length;
  resultMap.nodes = allResults;
  resultMap.items = allResults;
  resultMap.byNodeId = resultMap;
  resultMap.map = (fn) => allResults.map(fn);
  resultMap.find = (fn) => allResults.find(fn);
  resultMap.filter = (fn) => allResults.filter(fn);

  resultMap[Symbol.iterator] = function*() {
    for (const item of allResults) {
      yield item;
    }
  };

  if (options.asArray === true) {
    return allResults;
  }

  return resultMap;
}

/**
 * Computes deterministic planetary & stellar visual properties for a given node.
 * Uses linear listening proportional dimensioning when listening counts exist,
 * preserving mass-based legacy calculation as fallback.
 *
 * @param {Object} node Graph node from /api/graph
 * @param {Object} metadata Graph metadata (bridge_artist, modularity_score, etc.)
 * @param {string} graphMode "artists" | "bipartite"
 * @param {Array} links All graph links (for degree / cluster diversity inference)
 * @returns {Object} PlanetVisualProps
 */
export function computePlanetVisualProps(node = {}, metadata = {}, graphMode = "artists", links = []) {
  const nodeId = node?.id ?? "";
  const nodeType = node?.node_type === "genre" ? "genre" : "artist";
  const nodeClusterId = Number.isFinite(node?.cluster_id) ? node.cluster_id : 0;

  // 1. Sanitization & Normalization
  const rawAff = Number.isFinite(node?.affinity_score) ? node.affinity_score : 0.50;
  const S_aff = Math.min(1.00, Math.max(0.25, rawAff));
  const S_hat = Math.min(1.0, Math.max(0.0, (S_aff - 0.25) / 0.75));

  const rawPop = Number.isFinite(node?.global_popularity) ? node.global_popularity : 50;
  const P_glob = Math.min(100, Math.max(0, rawPop));
  const P_hat = P_glob / 100.0;

  const rawCd = Number.isFinite(node?.metrics?.degree_centrality) ? node.metrics.degree_centrality : 0.0;
  const C_D = Math.min(1.0, Math.max(0.0, rawCd));

  const rawCb = Number.isFinite(node?.metrics?.betweenness_centrality) ? node.metrics.betweenness_centrality : 0.0;
  const C_B = Math.min(1.0, Math.max(0.0, rawCb));

  // Connected artists count for genre nodes
  let k_g = null;
  if (nodeType === "genre") {
    if (Number.isFinite(node?.connected_artists_count) && node.connected_artists_count >= 1) {
      k_g = Math.min(50, Math.max(1, Math.round(node.connected_artists_count)));
    } else {
      let deg = 0;
      if (Array.isArray(links)) {
        for (const l of links) {
          const s = typeof l.source === "object" ? l.source?.id : l.source;
          const t = typeof l.target === "object" ? l.target?.id : l.target;
          if (s === nodeId || t === nodeId) deg++;
        }
      }
      k_g = Math.min(50, Math.max(1, deg > 0 ? deg : 1));
    }
  }

  const color = sanitizeNodeColor(node?.color);
  const name = sanitizeNodeName(node?.name);

  // 2. Mass & Dimensions
  const M = 0.55 * S_hat + 0.30 * P_hat + 0.15 * C_D;
  const isBipartite = graphMode === "bipartite";
  const geometryType = nodeType === "genre" ? "star_core" : "planet";

  const D_max = nodeType === "genre" ? MAX_GENRE_DIMENSION : MAX_ARTIST_DIMENSION;
  const R_max = D_max / 2.0;

  const rawL = node?.listening_count ?? node?.play_count;
  const hasListeningCount = rawL !== null && rawL !== undefined && Number.isFinite(Number(rawL)) && Number(rawL) > 0;
  const hasPrecalculated = Number.isFinite(node?.proportionalRadius) && node.proportionalRadius > 0;

  let listeningCount = 0;
  let listeningRank = null;
  let listeningRatio = 0;
  let dimension = 0;
  let radius = 3.50;
  let isFallbackListening = true;

  if (hasListeningCount || hasPrecalculated) {
    isFallbackListening = false;
    if (hasListeningCount) {
      listeningCount = Number(rawL);
      let L_max = 0;
      if (nodeType === "genre") {
        L_max = Number(
          metadata?.max_genre_listening_count ??
          metadata?.maxGenreListeningCount ??
          metadata?.max_listening_count ??
          metadata?.maxListeningCount ??
          listeningCount
        );
      } else {
        L_max = Number(
          metadata?.max_artist_listening_count ??
          metadata?.maxArtistListeningCount ??
          metadata?.max_listening_count ??
          metadata?.maxListeningCount ??
          listeningCount
        );
      }
      if (!Number.isFinite(L_max) || L_max <= 0) {
        L_max = listeningCount;
      }

      listeningRatio = listeningCount / L_max;
      dimension = (D_max * listeningCount) / L_max;
      radius = dimension / 2.0;
      listeningRank = Number.isFinite(node?.listeningRank) ? node.listeningRank : (node?.listening_rank ?? 1);
    } else {
      radius = Number(node.proportionalRadius);
      dimension = Number.isFinite(node?.proportionalDimension) ? Number(node.proportionalDimension) : radius * 2.0;
      listeningRatio = Number.isFinite(node?.listeningRatio) ? node.listeningRatio : (radius / R_max);
      listeningCount = Number.isFinite(node?.listeningCount) ? node.listeningCount : 0;
      listeningRank = node?.listeningRank ?? null;
    }
  } else {
    // Deterministic fallback based on mass M (preserves legacy test cases C1/C2)
    isFallbackListening = true;
    listeningCount = 0;
    listeningRatio = 0;
    listeningRank = null;

    if (nodeType === "genre") {
      radius = Number((5.0 + 10.0 * Math.min(1.0, k_g / 12.0)).toFixed(2));
    } else {
      if (isBipartite) {
        radius = Number((3.0 + 9.0 * M).toFixed(2));
      } else {
        radius = Number((3.5 + 10.5 * M).toFixed(2));
      }
    }
    dimension = radius * 2.0;
  }

  const hitRadius = Math.max(radius, 4.5);

  // 3. Atmospheric halo
  const radiationIndex = Math.min(1.0, Math.max(0.0, 0.70 * Math.sqrt(C_B) + 0.30 * C_D));
  const haloRadius = Number((radius * (1.15 + 1.25 * radiationIndex)).toFixed(2));
  const haloOpacity = Number((0.10 + 0.55 * Math.pow(radiationIndex, 0.80)).toFixed(3));

  // 4. Inter-cluster diversity & Orbital Ring
  let interClusterDiversity = 0.0;
  if (Array.isArray(links) && links.length > 0) {
    let incidentCount = 0;
    let diffClusterCount = 0;
    for (const l of links) {
      const s = l.source;
      const t = l.target;
      const sId = typeof s === "object" ? s?.id : s;
      const tId = typeof t === "object" ? t?.id : t;
      if (sId === nodeId || tId === nodeId) {
        incidentCount++;
        const other = sId === nodeId ? t : s;
        if (typeof other === "object" && Number.isFinite(other?.cluster_id)) {
          if (other.cluster_id !== nodeClusterId) diffClusterCount++;
        } else if (sId === nodeId && Number.isFinite(l.target_cluster)) {
          if (l.target_cluster !== nodeClusterId) diffClusterCount++;
        } else if (tId === nodeId && Number.isFinite(l.source_cluster)) {
          if (l.source_cluster !== nodeClusterId) diffClusterCount++;
        }
      }
    }
    if (incidentCount > 0) {
      interClusterDiversity = diffClusterCount / incidentCount;
    }
  }

  if (interClusterDiversity === 0.0 && Number.isFinite(node?.inter_cluster_diversity)) {
    interClusterDiversity = Math.min(1.0, Math.max(0.0, node.inter_cluster_diversity));
  }
  interClusterDiversity = Number(interClusterDiversity.toFixed(4));

  const isBridgeArtist = Boolean(metadata?.bridge_artist?.id && metadata.bridge_artist.id === nodeId);
  const hasOrbitalRing = Boolean(isBridgeArtist || interClusterDiversity >= 0.30);
  const ringInnerRadius = Number((1.35 * radius).toFixed(2));
  const ringOuterRadius = Number((2.05 * radius).toFixed(2));

  const h1 = hashString(nodeId);
  const h2 = hashString(nodeId + "_yaw");
  const ringTiltRad = Number(((((h1 % 50) - 25) / 180) * Math.PI).toFixed(4));
  const ringYawRad = Number((((h2 % 360) / 180) * Math.PI).toFixed(4));

  const textureFallbackMode = node?.image_url ? "photo_or_procedural" : "procedural_only";
  const connectedArtistsCount = nodeType === "genre" ? k_g : null;

  return {
    nodeId,
    name,
    color,
    nodeType,
    geometryType,
    radius,
    dimension,
    hitRadius,
    listeningCount,
    listeningRank,
    listeningRatio,
    isFallbackListening,
    massIndex: Number(M.toFixed(4)),
    radiationIndex: Number(radiationIndex.toFixed(4)),
    haloRadius,
    haloOpacity,
    isBridgeArtist,
    hasOrbitalRing,
    ringInnerRadius,
    ringOuterRadius,
    ringTiltRad,
    ringYawRad,
    interClusterDiversity,
    textureFallbackMode,
    connectedArtistsCount
  };
}

export const computeKnowledgeNodeVisualProps = computePlanetVisualProps;

/**
 * Computes 3D Fibonacci centroids for Louvain community star systems.
 *
 * @param {Array} clusters Array of cluster summaries from metadata.clusters
 * @param {number} modularityScore Louvain modularity score Q
 * @returns {Map<number, Object>} Map of cluster_id -> Centroid3D
 */
export function computeClusterCentroids(clusters = [], modularityScore = 0.0) {
  const centroids = new Map();
  const Q = Number.isFinite(modularityScore) ? Math.min(1.0, Math.max(-0.5, modularityScore)) : 0.0;
  const R_galaxy = 220.0 * (1.0 + 1.8 * Math.max(0.0, Q));
  const phi = Math.PI * (3 - Math.sqrt(5)); // Golden Angle ~ 2.39996323

  const clusterList = Array.isArray(clusters) ? clusters : [];
  const K = clusterList.length;

  if (K === 0) {
    return centroids;
  }

  if (K === 1) {
    const c = clusterList[0] || {};
    const cId = c.cluster_id ?? 0;
    centroids.set(cId, {
      cluster_id: cId,
      x: 0.0,
      y: 0.0,
      z: 0.0,
      radius: Number(R_galaxy.toFixed(2)),
      color: c.color || CLUSTER_PALETTE[0],
      dominant_genres: Array.isArray(c.dominant_genres) ? c.dominant_genres : [],
      artist_count: Number.isFinite(c.artist_count) ? c.artist_count : 0,
      label: c.label || (c.dominant_genres?.[0] ? `Constelação ${c.dominant_genres[0]}` : "Sistema 1")
    });
    return centroids;
  }

  for (let k = 0; k < K; k++) {
    const c = clusterList[k] || {};
    const cId = c.cluster_id ?? k;
    const z_k = 1.0 - (2 * k + 1) / K;
    const rho_k = Math.sqrt(Math.max(0.0, 1.0 - z_k * z_k));
    const theta_k = k * phi;

    const x = Number((R_galaxy * rho_k * Math.cos(theta_k)).toFixed(2));
    const y = Number((R_galaxy * rho_k * Math.sin(theta_k)).toFixed(2));
    const z = Number((R_galaxy * z_k).toFixed(2));

    centroids.set(cId, {
      cluster_id: cId,
      x,
      y,
      z,
      radius: Number(R_galaxy.toFixed(2)),
      color: c.color || CLUSTER_PALETTE[k % CLUSTER_PALETTE.length],
      dominant_genres: Array.isArray(c.dominant_genres) ? c.dominant_genres : [],
      artist_count: Number.isFinite(c.artist_count) ? c.artist_count : 0,
      label: c.label || (c.dominant_genres?.[0] ? `Constelação ${c.dominant_genres[0]}` : `Sistema ${k + 1}`)
    });
  }

  return centroids;
}

/**
 * Decomposes and explains edge weight based on the 4-attribute formula:
 * 0.65g + 0.25c + 0.10t + shared_genres qualitative classification.
 *
 * @param {Object} link Edge payload
 * @param {string} graphMode "artists" | "bipartite"
 * @returns {Object} EdgeExplanation
 */
export function decomposeEdgeWeight(link = {}, graphMode = "artists") {
  const isBipartite = graphMode === "bipartite" || link?.link_type === "artist-genre";

  if (isBipartite && link?.link_type === "artist-genre") {
    const rawWeight = Number.isFinite(link?.weight) ? link.weight : 0.35;
    const weight = Number(Math.min(1.0, Math.max(0.0, rawWeight)).toFixed(4));
    return {
      linkType: "artist-genre",
      weight,
      calculatedWeight: weight,
      components: null,
      sharedGenres: Array.isArray(link?.shared_genres) ? link.shared_genres : [],
      genreMatchType: "artist_genre_membership"
    };
  }

  // artist-artist or genre-genre
  if (link?.link_type === "genre-genre") {
    const rawWeight = Number.isFinite(link?.weight) ? link.weight : 0.25;
    const weight = Number(Math.min(1.0, Math.max(0.0, rawWeight)).toFixed(4));
    return {
      linkType: "genre-genre",
      weight,
      calculatedWeight: weight,
      components: null,
      sharedGenres: Array.isArray(link?.shared_genres) ? link.shared_genres : [],
      sharedArtists: Array.isArray(link?.shared_artists) ? link.shared_artists : [],
      genreMatchType: "genre_genre_projection"
    };
  }

  const comps = link?.components || {};
  const gRaw = Number.isFinite(comps.genre_similarity) ? comps.genre_similarity : 0.0;
  const cRaw = Number.isFinite(comps.direct_collaboration) ? comps.direct_collaboration : 0.0;
  const tRaw = Number.isFinite(comps.co_listening) ? comps.co_listening : 0.0;

  const g = Math.min(1.0, Math.max(0.0, gRaw));
  const c = Math.min(1.0, Math.max(0.0, cRaw));
  const t = Math.min(1.0, Math.max(0.0, tRaw));

  const Cg = Number((0.65 * g).toFixed(4));
  const Cc = Number((0.25 * c).toFixed(4));
  const Ct = Number((0.10 * t).toFixed(4));

  const calculatedWeight = Number(Math.min(1.0, Math.max(0.0, Cg + Cc + Ct)).toFixed(4));
  const rawWeight = Number.isFinite(link?.weight) ? link.weight : calculatedWeight;
  const weight = Number(Math.min(1.0, Math.max(0.0, rawWeight)).toFixed(4));

  const sharedGenres = Array.isArray(link?.shared_genres) ? link.shared_genres : [];

  let genreMatchType = "none";
  if (sharedGenres.length > 0 && g > 0) {
    genreMatchType = "exact_and_subtoken_match";
  } else if (sharedGenres.length === 0 && g > 0) {
    genreMatchType = "subtoken_lexical_match";
  }

  return {
    linkType: "artist-artist",
    weight,
    calculatedWeight,
    components: {
      genre_similarity: Number(g.toFixed(4)),
      direct_collaboration: Number(c.toFixed(4)),
      co_listening: Number(t.toFixed(4)),
      C_g: Cg,
      C_c: Cc,
      C_t: Ct,
      weights: { alpha: 0.65, beta: 0.25, gamma: 0.10 }
    },
    sharedGenres,
    genreMatchType
  };
}

/**
 * Deterministically filters graph nodes and links based on threshold, search, types, and clusters.
 * When filtering solely by genre (nodeTypeFilter === 'genre'), projects genre-genre connections
 * between genres sharing >= 1 artist (or in the same cluster if single-artist).
 *
 * @param {Object} graphData { metadata, nodes: [], links: [] }
 * @param {Object} filterState Filter criteria
 * @returns {Object} { nodes, links, matchedNodeIds, stats }
 */
export function filterSpaceGraph(graphData = {}, filterState = {}) {
  const rawNodes = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
  const rawLinks = Array.isArray(graphData?.links) ? graphData.links : [];

  // minEdgeWeight: clamp [0.05, 0.65], default 0.15
  const rawMinWeight = Number.isFinite(filterState?.minEdgeWeight) ? filterState.minEdgeWeight : DEFAULT_MIN_EDGE_WEIGHT;
  const minEdgeWeight = Number(Math.min(0.65, Math.max(0.05, rawMinWeight)).toFixed(2));

  // searchQuery: trim, max 80 chars, lowercase
  const rawQuery = typeof filterState?.searchQuery === "string" ? filterState.searchQuery : "";
  const searchQuery = rawQuery.trim().slice(0, 80).toLowerCase();

  // nodeTypeFilter: "all" | "artist" | "genre"
  const nodeTypeFilter = (filterState?.nodeTypeFilter === "artist" || filterState?.nodeTypeFilter === "genre")
    ? filterState.nodeTypeFilter
    : "all";

  // visibleNodeTypes: Set or array if provided
  let visibleNodeTypesSet = null;
  if (filterState?.visibleNodeTypes) {
    visibleNodeTypesSet = new Set(
      Array.isArray(filterState.visibleNodeTypes)
        ? filterState.visibleNodeTypes
        : Array.from(filterState.visibleNodeTypes)
    );
  }

  // hiddenClusters: Set of cluster_ids
  const hiddenClustersSet = new Set();
  if (filterState?.hiddenClusters) {
    const list = Array.isArray(filterState.hiddenClusters)
      ? filterState.hiddenClusters
      : Array.from(filterState.hiddenClusters);
    for (const cid of list) {
      if (cid !== null && cid !== undefined) hiddenClustersSet.add(cid);
    }
  }

  const matchedNodeIds = new Set();

  // Filter nodes
  const filteredNodes = rawNodes.filter((node) => {
    if (!node || typeof node !== "object") return false;

    // 1. Cluster visibility
    const clusterId = node.cluster_id ?? 0;
    if (hiddenClustersSet.has(clusterId)) return false;

    // 2. Node type filter
    const nodeType = node.node_type || "artist";
    if (nodeTypeFilter !== "all" && nodeType !== nodeTypeFilter) return false;
    if (visibleNodeTypesSet && !visibleNodeTypesSet.has(nodeType)) return false;

    // 3. Search query matching
    const nameMatch = typeof node.name === "string" && node.name.toLowerCase().includes(searchQuery);
    const genreMatch = Array.isArray(node.genres) && node.genres.some(
      (g) => typeof g === "string" && g.toLowerCase().includes(searchQuery)
    );
    const isSearchMatch = searchQuery.length === 0 || nameMatch || genreMatch;

    if (searchQuery.length > 0 && isSearchMatch) {
      matchedNodeIds.add(node.id);
    }

    if (searchQuery.length > 0 && filterState.filterNodesBySearch !== false) {
      return isSearchMatch;
    }

    return true;
  });

  const visibleNodeIdSet = new Set(filteredNodes.map((n) => n.id));

  // Filter links
  const filteredLinks = rawLinks.filter((link) => {
    if (!link || typeof link !== "object") return false;

    const w = Number.isFinite(link.weight) ? link.weight : 0.0;
    if (w < minEdgeWeight) return false;

    const sId = typeof link.source === "object" ? link.source?.id : link.source;
    const tId = typeof link.target === "object" ? link.target?.id : link.target;

    return visibleNodeIdSet.has(sId) && visibleNodeIdSet.has(tId);
  });

  // Requirement 3: When nodeTypeFilter === 'genre', if filteredLinks has no direct connections
  // between the visible genre nodes, build projected genre-genre connections
  if (nodeTypeFilter === "genre" && filteredNodes.length >= 2) {
    const hasGenreGenreLinks = filteredLinks.some((l) => l.link_type === "genre-genre");
    if (!hasGenreGenreLinks) {
      const allNodeMap = new Map();
      for (const n of rawNodes) {
        if (n && n.id) allNodeMap.set(n.id, n);
      }

      const genreToArtists = new Map();
      for (const l of rawLinks) {
        const sId = typeof l.source === "object" ? l.source?.id : l.source;
        const tId = typeof l.target === "object" ? l.target?.id : l.target;
        if (!sId || !tId) continue;
        const sNode = allNodeMap.get(sId);
        const tNode = allNodeMap.get(tId);

        const isSGenre = sNode?.node_type === "genre" || String(sId).startsWith("genre::");
        const isTGenre = tNode?.node_type === "genre" || String(tId).startsWith("genre::");
        const isSArtist = sNode?.node_type === "artist" || (!isSGenre && !String(sId).startsWith("genre::"));
        const isTArtist = tNode?.node_type === "artist" || (!isTGenre && !String(tId).startsWith("genre::"));

        if (isSGenre && isTArtist) {
          if (!genreToArtists.has(sId)) genreToArtists.set(sId, new Set());
          genreToArtists.get(sId).add(tId);
        } else if (isTGenre && isSArtist) {
          if (!genreToArtists.has(tId)) genreToArtists.set(tId, new Set());
          genreToArtists.get(tId).add(sId);
        }
      }

      const projectedLinks = [];
      let maxShared = 1;
      const candidatePairs = [];

      for (let i = 0; i < filteredNodes.length; i++) {
        const g1 = filteredNodes[i];
        const artists1 = genreToArtists.get(g1.id) || new Set();

        for (let j = i + 1; j < filteredNodes.length; j++) {
          const g2 = filteredNodes[j];
          const artists2 = genreToArtists.get(g2.id) || new Set();

          const sharedArtists = [];
          for (const aId of artists1) {
            if (artists2.has(aId)) sharedArtists.push(aId);
          }

          const sameCluster = Number.isFinite(g1.cluster_id) && g1.cluster_id === g2.cluster_id;
          const count1 = artists1.size;
          const count2 = artists2.size;
          const qualifies = sharedArtists.length >= 1 || (sameCluster && (count1 <= 1 || count2 <= 1));

          if (qualifies) {
            if (sharedArtists.length > maxShared) {
              maxShared = sharedArtists.length;
            }
            candidatePairs.push({
              g1,
              g2,
              sharedArtists,
              sameCluster
            });
          }
        }
      }

      for (const pair of candidatePairs) {
        const { g1, g2, sharedArtists, sameCluster } = pair;
        let weight = 0.25;
        if (sharedArtists.length >= 1) {
          weight = Number((0.25 + 0.75 * Math.min(1.0, sharedArtists.length / Math.max(maxShared, 1))).toFixed(4));
        } else if (sameCluster) {
          weight = 0.25;
        }

        projectedLinks.push({
          source: g1.id,
          target: g2.id,
          weight,
          link_type: "genre-genre",
          shared_artists: sharedArtists,
          shared_genres: [g1.name, g2.name],
          cluster_id: g1.cluster_id
        });
      }

      if (projectedLinks.length > 0) {
        filteredLinks.push(...projectedLinks);
      }
    }
  }

  const stats = {
    totalNodes: rawNodes.length,
    visibleNodes: filteredNodes.length,
    totalLinks: rawLinks.length,
    visibleLinks: filteredLinks.length,
    minEdgeWeight,
    hiddenClustersCount: hiddenClustersSet.size,
    matchedNodesCount: matchedNodeIds.size
  };

  return {
    nodes: filteredNodes,
    links: filteredLinks,
    matchedNodeIds,
    stats
  };
}

/**
 * Computes 1-hop direct connections and top 8 2-hop harmonic indirect connections.
 * When target is a genre (or fullGraphData is provided), preserves and includes
 * connectedArtists from the full graph so the Inspector displays them even when canvas filters genres.
 *
 * @param {string} nodeId Target node id
 * @param {Object} filteredGraph { nodes: [], links: [] }
 * @param {string} graphMode "artists" | "bipartite"
 * @param {Object|null} fullGraphData Full unfiltered graph data { nodes, links }
 * @returns {Object} NodeNeighborhood
 */
export function computeNodeNeighborhood(nodeId, filteredGraph = {}, graphMode = "artists", fullGraphData = null) {
  const nodes = Array.isArray(filteredGraph?.nodes) ? filteredGraph.nodes : [];
  const links = Array.isArray(filteredGraph?.links) ? filteredGraph.links : [];

  const nodeMap = new Map();
  for (const n of nodes) {
    if (n && n.id) nodeMap.set(n.id, n);
  }

  const fullNodes = Array.isArray(fullGraphData?.nodes) ? fullGraphData.nodes : [];
  const fullLinks = Array.isArray(fullGraphData?.links) ? fullGraphData.links : [];
  const fullNodeMap = new Map();
  for (const n of fullNodes) {
    if (n && n.id) fullNodeMap.set(n.id, n);
  }

  const targetNode = nodeMap.get(nodeId) || fullNodeMap.get(nodeId) || null;
  const directConnections = [];
  const directNeighborIds = new Set();
  const highlightNodeIds = new Set();
  const highlightLinkKeys = new Set();

  if (!nodeId || !targetNode) {
    return {
      nodeId,
      targetNode: null,
      directConnections: [],
      indirectConnections: [],
      connectedArtists: [],
      highlightNodeIds,
      highlightLinkKeys
    };
  }

  highlightNodeIds.add(nodeId);

  // Build symmetric adjacency map: id -> Map(neighborId -> link)
  const adj = new Map();
  for (const l of links) {
    const sId = typeof l.source === "object" ? l.source?.id : l.source;
    const tId = typeof l.target === "object" ? l.target?.id : l.target;
    if (!sId || !tId) continue;

    if (!adj.has(sId)) adj.set(sId, new Map());
    if (!adj.has(tId)) adj.set(tId, new Map());

    const curST = adj.get(sId).get(tId);
    if (!curST || (l.weight || 0) > (curST.weight || 0)) {
      adj.get(sId).set(tId, l);
      adj.get(tId).set(sId, l);
    }

    if (sId === nodeId || tId === nodeId) {
      const neighborId = sId === nodeId ? tId : sId;
      const neighborNode = nodeMap.get(neighborId) || fullNodeMap.get(neighborId);
      if (neighborNode) {
        directNeighborIds.add(neighborId);
        highlightNodeIds.add(neighborId);
        highlightLinkKeys.add(`${sId}__${tId}`);
        highlightLinkKeys.add(`${tId}__${sId}`);

        directConnections.push({
          nodeId: neighborId,
          node: neighborNode,
          link: l,
          weight: Number.isFinite(l.weight) ? Number(l.weight.toFixed(4)) : 0.15,
          decomposition: decomposeEdgeWeight(l, graphMode)
        });
      }
    }
  }

  // Sort 1-hop: weight desc, then name asc
  directConnections.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    const nameA = a.node?.name || "";
    const nameB = b.node?.name || "";
    return nameA.localeCompare(nameB);
  });

  // Requirement 4: Connected artists for genre nodes from fullGraphData (or graphData)
  const isGenreNode = targetNode?.node_type === "genre" || String(nodeId).startsWith("genre::");
  const connectedArtists = [];

  const candidateSourceLinks = fullLinks.length > 0 ? fullLinks : links;
  const candidateLookupMap = fullNodes.length > 0 ? fullNodeMap : nodeMap;

  if (isGenreNode || fullGraphData !== null) {
    const seenArtistIds = new Set();
    for (const l of candidateSourceLinks) {
      const sId = typeof l.source === "object" ? l.source?.id : l.source;
      const tId = typeof l.target === "object" ? l.target?.id : l.target;
      if (sId === nodeId || tId === nodeId) {
        const otherId = sId === nodeId ? tId : sId;
        const otherNode = candidateLookupMap.get(otherId);
        const isArtist = otherNode ? (otherNode.node_type === "artist" || !otherNode.node_type) : (!String(otherId).startsWith("genre::"));

        if (isArtist && !seenArtistIds.has(otherId)) {
          seenArtistIds.add(otherId);
          connectedArtists.push({
            nodeId: otherId,
            node: otherNode || { id: otherId, name: sanitizeNodeName(otherId), node_type: "artist" },
            link: l,
            weight: Number.isFinite(l.weight) ? Number(l.weight.toFixed(4)) : 0.50,
            decomposition: decomposeEdgeWeight(l, "bipartite")
          });
        }
      }
    }

    connectedArtists.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      const nameA = a.node?.name || "";
      const nameB = b.node?.name || "";
      return nameA.localeCompare(nameB);
    });

    if (connectedArtists.length > 0) {
      const hasArtistInDirect = directConnections.some(c => c.node?.node_type === "artist" || !c.node?.node_type);
      if (directConnections.length === 0 || !hasArtistInDirect) {
        for (const ca of connectedArtists) {
          if (!directConnections.some(dc => dc.nodeId === ca.nodeId)) {
            directConnections.push(ca);
          }
          highlightNodeIds.add(ca.nodeId);
        }
      }
      for (const ca of connectedArtists) {
        highlightNodeIds.add(ca.nodeId);
      }
    }
  }

  // 2-Hop Candidates: z not in {nodeId} and not in directNeighborIds
  const candidate2HopMap = new Map();

  for (const mId of directNeighborIds) {
    const mLinks = adj.get(mId);
    if (!mLinks) continue;
    const linkUm = mLinks.get(nodeId);
    const w_um = Number.isFinite(linkUm?.weight) ? linkUm.weight : 0.15;
    const mNode = nodeMap.get(mId) || fullNodeMap.get(mId);

    for (const [zId, linkMz] of mLinks.entries()) {
      if (zId === nodeId || directNeighborIds.has(zId)) continue;
      const zNode = nodeMap.get(zId) || fullNodeMap.get(zId);
      if (!zNode) continue;

      const w_mz = Number.isFinite(linkMz?.weight) ? linkMz.weight : 0.15;

      if (!candidate2HopMap.has(zId)) {
        candidate2HopMap.set(zId, []);
      }
      candidate2HopMap.get(zId).push({
        bridgeId: mId,
        bridgeNode: mNode,
        weightToTarget: Number(w_um.toFixed(4)),
        weightToNeighbor: Number(w_mz.toFixed(4)),
        pathScore: Number((0.70 * w_um * w_mz).toFixed(4)),
        linkToTarget: linkUm,
        linkToNeighbor: linkMz
      });
    }
  }

  const indirectConnections = [];
  for (const [zId, bridges] of candidate2HopMap.entries()) {
    const zNode = nodeMap.get(zId) || fullNodeMap.get(zId);
    bridges.sort((a, b) => b.pathScore - a.pathScore);

    // Multi-path harmonic relevance: A_2hop = 1 - prod(1 - 0.70 * w_um * w_mz)
    let prod = 1.0;
    for (const b of bridges) {
      prod *= (1.0 - 0.70 * b.weightToTarget * b.weightToNeighbor);
    }
    const relevanceScore = Number(Math.min(1.0, Math.max(0.0, 1.0 - prod)).toFixed(4));

    indirectConnections.push({
      nodeId: zId,
      node: zNode,
      relevanceScore,
      bridgeCount: bridges.length,
      viaBridges: bridges
    });
  }

  // Sort 2-hop: relevanceScore desc, then bridgeCount desc, then name asc
  indirectConnections.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (b.bridgeCount !== a.bridgeCount) return b.bridgeCount - a.bridgeCount;
    const nameA = a.node?.name || "";
    const nameB = b.node?.name || "";
    return nameA.localeCompare(nameB);
  });

  const top8Indirect = indirectConnections.slice(0, 8);

  for (const item of top8Indirect) {
    highlightNodeIds.add(item.nodeId);
    for (const b of item.viaBridges) {
      highlightLinkKeys.add(`${b.bridgeId}__${item.nodeId}`);
      highlightLinkKeys.add(`${item.nodeId}__${b.bridgeId}`);
    }
  }

  return {
    nodeId,
    targetNode,
    directConnections,
    indirectConnections: top8Indirect,
    connectedArtists,
    highlightNodeIds,
    highlightLinkKeys
  };
}

/**
 * Separates measured Spotify source facts from BeatCode topological inferences.
 *
 * @param {Object} node Node payload
 * @param {string} graphMode "artists" | "bipartite"
 * @returns {Object} Provenance profile
 */
export function buildNodeProvenanceProfile(node = {}, graphMode = "artists") {
  if (!node || typeof node !== "object") {
    return {
      nodeId: "",
      nodeType: "artist",
      spotifyFacts: [],
      beatcodeInferences: [],
      raw: { spotify: {}, inferences: {} }
    };
  }

  const nodeId = node.id || "";
  const nodeType = node.node_type === "genre" ? "genre" : "artist";

  const rawL = node.listening_count ?? node.play_count;
  const listeningCount = Number.isFinite(Number(rawL)) ? Number(rawL) : null;

  const spotifyFacts = [
    { key: "name", label: "Nome", value: sanitizeNodeName(node.name), tag: "[DADO SPOTIFY]" },
    { key: "affinity_rank", label: "Posição no Top Ouvidos", value: node.affinity_rank ?? null, tag: "[DADO SPOTIFY]" },
    { key: "listening_count", label: "Contagem de Escutas", value: listeningCount, tag: "[DADO SPOTIFY]" },
    { key: "global_popularity", label: "Popularidade Global", value: Number.isFinite(node.global_popularity) ? node.global_popularity : 50, tag: "[DADO SPOTIFY]" },
    { key: "genres", label: "Gêneros Musicais", value: Array.isArray(node.genres) ? node.genres : [], tag: "[DADO SPOTIFY]" },
    { key: "top_tracks", label: "Músicas Principais", value: Array.isArray(node.top_tracks) ? node.top_tracks : [], tag: "[DADO SPOTIFY]" },
    { key: "spotify_url", label: "Link no Spotify", value: node.spotify_url || (nodeId && nodeType === "artist" ? `https://open.spotify.com/artist/${nodeId}` : null), tag: "[DADO SPOTIFY]" },
    { key: "image_url", label: "Foto de Perfil", value: node.image_url || null, tag: "[DADO SPOTIFY]" }
  ];

  const degreeCent = Number.isFinite(node.metrics?.degree_centrality) ? node.metrics.degree_centrality : 0.0;
  const betweennessCent = Number.isFinite(node.metrics?.betweenness_centrality) ? node.metrics.betweenness_centrality : 0.0;
  const clusterId = Number.isFinite(node.cluster_id) ? node.cluster_id : 0;
  const affScore = Number.isFinite(node.affinity_score) ? node.affinity_score : null;
  const connectedArtistsCount = nodeType === "genre"
    ? (Number.isFinite(node.connected_artists_count) ? node.connected_artists_count : 1)
    : null;

  const beatcodeInferences = [
    {
      key: "affinity_score",
      label: "Score de Afinidade",
      value: affScore,
      tag: "[INFERÊNCIA BEATCODE]",
      description: "Transformação linear baseada na ordem ordinal dos mais ouvidos"
    },
    {
      key: "listening_rank",
      label: "Ranking Proporcional de Escuta",
      value: node.listeningRank ?? null,
      tag: "[INFERÊNCIA BEATCODE]",
      description: "Posição ordinal na distribuição de escutas registradas"
    },
    {
      key: "degree_centrality",
      label: "Centralidade de Grau",
      value: Number(degreeCent.toFixed(3)),
      tag: "[INFERÊNCIA BEATCODE]",
      description: "Densidade de conexões diretas na rede podada (k-NN + MST)"
    },
    {
      key: "betweenness_centrality",
      label: "Centralidade de Intermediação",
      value: Number(betweennessCent.toFixed(3)),
      tag: "[INFERÊNCIA BEATCODE]",
      description: "Frequência como ponte nos caminhos mais curtos da rede"
    },
    {
      key: "cluster_id",
      label: "Constelação / Sistema Estelar",
      value: clusterId,
      tag: "[INFERÊNCIA BEATCODE]",
      description: "Partição de comunidades detectada pelo algoritmo Louvain"
    },
    {
      key: "connected_artists_count",
      label: "Artistas Conectados ao Gênero",
      value: connectedArtistsCount,
      tag: "[INFERÊNCIA BEATCODE]",
      description: "Incidência de artistas associados a este hub semântico"
    }
  ];

  return {
    nodeId,
    nodeType,
    spotifyFacts,
    beatcodeInferences,
    raw: {
      spotify: {
        name: sanitizeNodeName(node.name),
        affinity_rank: node.affinity_rank ?? null,
        listening_count: listeningCount,
        global_popularity: Number.isFinite(node.global_popularity) ? node.global_popularity : 50,
        genres: Array.isArray(node.genres) ? node.genres : [],
        top_tracks: Array.isArray(node.top_tracks) ? node.top_tracks : [],
        spotify_url: node.spotify_url || null,
        image_url: node.image_url || null
      },
      inferences: {
        affinity_score: affScore,
        listening_rank: node.listeningRank ?? null,
        degree_centrality: Number(degreeCent.toFixed(3)),
        betweenness_centrality: Number(betweennessCent.toFixed(3)),
        cluster_id: clusterId,
        connected_artists_count: connectedArtistsCount
      }
    }
  };
}

/**
 * Derives current cosmic exploration depth indicator.
 *
 * @param {Object} params { selectedNode, focusedClusterId }
 * @returns {Object} { code, label }
 */
export function deriveExplorationDepth({ selectedNode = null, focusedClusterId = null } = {}) {
  let code = "universe";
  let label = "Universo";

  if (selectedNode) {
    code = "planet_orbit";
    label = "Órbita Planetária";
  } else if (focusedClusterId !== null && focusedClusterId !== undefined) {
    code = "star_system";
    label = "Sistema Estelar";
  }

  return {
    code,
    label,
    toString() { return this.code; },
    valueOf() { return this.code; }
  };
}

/**
 * Calculates 3D camera flight position and lookAt vectors with reduced-motion support.
 *
 * @param {Object} params { action, node, clusterCentroid, reducedMotion }
 * @returns {Object} CameraFlightTarget
 */
export function resolveCameraFlightTarget({ action = "overview", node = null, clusterCentroid = null, reducedMotion = false } = {}) {
  const isReduced = Boolean(reducedMotion);

  if (action === "focus_planet" && node) {
    const x = Number(node.x) || 0;
    const y = Number(node.y) || 0;
    const z = Number(node.z) || 0;
    return {
      action: "focus_planet",
      depth: "planet_orbit",
      lookAt: { x, y, z },
      position: { x, y: y + 15, z: z + 45 },
      transitionMs: isReduced ? 0 : 800
    };
  }

  if (action === "focus_cluster" && clusterCentroid) {
    const x = Number(clusterCentroid.x) || 0;
    const y = Number(clusterCentroid.y) || 0;
    const z = Number(clusterCentroid.z) || 0;
    return {
      action: "focus_cluster",
      depth: "star_system",
      lookAt: { x, y, z },
      position: { x, y: y + 80, z: z + 220 },
      transitionMs: isReduced ? 0 : 1000
    };
  }

  // Overview / reset
  return {
    action: "overview",
    depth: "universe",
    lookAt: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 600 },
    transitionMs: isReduced ? 0 : 1200
  };
}

/**
 * Computes motion parameters honoring prefers-reduced-motion and user preferences.
 *
 * @param {Object} params { prefersReducedMotion, userReducedMotion }
 * @returns {Object} MotionConfig
 */
export function computeMotionConfig({ prefersReducedMotion = false, userReducedMotion = false } = {}) {
  const isReduced = Boolean(prefersReducedMotion || userReducedMotion);

  if (isReduced) {
    return {
      reducedMotion: true,
      autoRotate: false,
      autoRotateSpeed: 0,
      directionalParticles: 0,
      pulseAmplitude: 0,
      cameraTransitionMs: 0
    };
  }

  return {
    reducedMotion: false,
    autoRotate: true,
    autoRotateSpeed: 0.6,
    directionalParticles: 60,
    pulseAmplitude: 1.0,
    cameraTransitionMs: 800
  };
}

/**
 * State machine for WebGL support checks, context loss, and recovery.
 *
 * @param {Object} currentState Current view / fallback state
 * @param {string} eventType "webgl_unsupported" | "webglcontextlost" | "webglcontextrestored"
 * @param {Object} payload Optional metadata
 * @returns {Object} WebGLFallbackState
 */
export function resolveWebGLFallbackState(currentState = {}, eventType = "", payload = {}) {
  const base = {
    viewMode: currentState?.viewMode || "space_3d",
    preferredViewMode: currentState?.preferredViewMode || currentState?.viewMode || "space_3d",
    webglHealthy: currentState?.webglHealthy !== false,
    webglSupported: currentState?.webglSupported !== false,
    statusBanner: currentState?.statusBanner || null,
    selectedNodeId: currentState?.selectedNodeId ?? null,
    minEdgeWeight: currentState?.minEdgeWeight ?? DEFAULT_MIN_EDGE_WEIGHT,
    searchQuery: currentState?.searchQuery ?? "",
    hiddenClusters: currentState?.hiddenClusters || new Set()
  };

  switch (eventType) {
    case "webgl_unsupported":
      return {
        ...base,
        viewMode: "map_2d",
        webglSupported: false,
        webglHealthy: false,
        statusBanner: {
          type: "warning",
          code: "webgl_unsupported",
          message: "WebGL não suportado neste navegador. Exibindo modo 2D de alta compatibilidade."
        }
      };

    case "webglcontextlost":
      return {
        ...base,
        viewMode: "map_2d",
        webglHealthy: false,
        statusBanner: {
          type: "error",
          code: "webglcontextlost",
          message: "Contexto WebGL perdido. Alternado automaticamente para o modo 2D."
        }
      };

    case "webglcontextrestored":
      return {
        ...base,
        viewMode: base.preferredViewMode === "map_2d" ? "map_2d" : "space_3d",
        webglHealthy: true,
        webglSupported: true,
        statusBanner: null
      };

    default:
      return base;
  }
}
