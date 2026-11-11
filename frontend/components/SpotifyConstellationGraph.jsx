"use client";

/* global window, document */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import * as d3 from "d3-force";
import {
  computeListeningProportionalDimensions,
  computePlanetVisualProps,
  computeClusterCentroids,
  filterSpaceGraph,
  computeNodeNeighborhood,
  deriveExplorationDepth,
  resolveCameraFlightTarget,
  computeMotionConfig,
  resolveWebGLFallbackState,
  escapeHtml,
} from "../lib/spaceGraphModel";
import {
  loadSpacePreferences,
  saveSpacePreferences,
  recordVisitedPlanet,
} from "../lib/spacePreferences";
import {
  createPlanetObject3D,
  createCosmicStarfield,
  configureSpaceForces3D,
  attachWebGLContextListeners,
  createResourceRegistry,
  disposeThreeUniverse,
} from "./space/PlanetaryRenderer";
import { SpaceHudControls } from "./space/SpaceHudControls";
import { SpaceInspectorPanel } from "./space/SpaceInspectorPanel";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function detectWebGLSupport() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return true;
  }
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

/**
 * Derives raw listening count L_i for a node (artist or genre).
 */
function extractRawListeningCount(node) {
  if (!node || typeof node !== "object") return 1;
  if (Number.isFinite(node.listening_count) && node.listening_count > 0) {
    return Math.round(node.listening_count);
  }
  if (Number.isFinite(node.play_count) && node.play_count > 0) {
    return Math.round(node.play_count);
  }
  if (node.node_type === "genre") {
    return Math.max(1, Math.round(Number(node.connected_artists_count) || 1));
  }
  const aff = Number.isFinite(node.affinity_score) ? node.affinity_score : 0.5;
  const pop = Number.isFinite(node.global_popularity) ? node.global_popularity : 50;
  return Math.max(1, Math.round(aff * 100 + pop * 0.2));
}

export default function SpotifyConstellationGraph() {
  const fg3dRef = useRef(null);
  const fg2dRef = useRef(null);
  const graphContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const imageCache = useRef({});
  const resourceRegistryRef = useRef(createResourceRegistry());
  const starfieldObjectRef = useRef(null);
  const sceneRef = useRef(null);

  // Guard ref to prevent zoom reset on hover or subsequent simulation ticks
  const hasInitialFitRef = useRef(false);
  const hoverNodeRef = useRef(null);
  const selectedNodeRef = useRef(null);
  const activeNeighborhoodRef = useRef({
    highlightNodeIds: new Set(),
    highlightLinkKeys: new Set(),
  });
  const visualPropsByNodeIdRef = useRef(new Map());
  const motionConfigRef = useRef({
    reducedMotion: false,
    directionalParticles: 60,
  });

  const [graphData, setGraphData] = useState({ metadata: null, nodes: [], links: [] });
  const [experience, setExperience] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [graphSize, setGraphSize] = useState({ width: 960, height: 640 });

  // Graphify 3D preferences & HUD state
  const [viewMode, setViewMode] = useState("space_3d");
  const [preferredViewMode, setPreferredViewMode] = useState("space_3d");
  const [graphMode, setGraphMode] = useState("artists");
  const [timeRange, setTimeRange] = useState("medium_term");
  const [minEdgeWeight, setMinEdgeWeight] = useState(0.15);
  const [nodeTypeFilter, setNodeTypeFilter] = useState("all");
  const [hiddenClusters, setHiddenClusters] = useState([]);
  const [visualEffects, setVisualEffects] = useState({
    starfield: false,
    orbital_rings: false,
    reduced_motion: false,
  });
  const [recentPlanets, setRecentPlanets] = useState([]);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  // Interactive exploration state
  const [searchQuery, setSearchQuery] = useState("");
  const [hoverNode, setHoverNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [focusedClusterId, setFocusedClusterId] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [webglHealthy, setWebglHealthy] = useState(true);
  const [statusBanner, setStatusBanner] = useState(null);

  // 1. Hydrate saved preferences & check WebGL support + prefers-reduced-motion
  useEffect(() => {
    const loaded = loadSpacePreferences();
    const initialNodeType = loaded.node_type_filter || "all";
    const initialGraphMode =
      initialNodeType === "genre" && loaded.graph_mode === "artists"
        ? "bipartite"
        : loaded.graph_mode;

    setGraphMode(initialGraphMode);
    setTimeRange(loaded.time_range);
    setMinEdgeWeight(loaded.min_edge_weight);
    setNodeTypeFilter(initialNodeType);
    setHiddenClusters(loaded.hidden_clusters || []);
    setVisualEffects(loaded.visual_effects);
    setRecentPlanets(loaded.recent_planets || []);
    setPreferredViewMode(loaded.view_mode);

    const supported = detectWebGLSupport();
    if (!supported) {
      const fb = resolveWebGLFallbackState(
        {
          viewMode: loaded.view_mode,
          preferredViewMode: loaded.view_mode,
          minEdgeWeight: loaded.min_edge_weight,
        },
        "webgl_unsupported"
      );
      setViewMode(fb.viewMode);
      setWebglHealthy(false);
      setStatusBanner(fb.statusBanner);
    } else {
      setViewMode(loaded.view_mode);
      setWebglHealthy(true);
    }

    setPrefsHydrated(true);

    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(Boolean(mq.matches));
      const handleMotionChange = (evt) => setPrefersReducedMotion(Boolean(evt.matches));
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", handleMotionChange);
        return () => mq.removeEventListener("change", handleMotionChange);
      }
    }
    return undefined;
  }, []);

  // Synchronize graphMode & nodeTypeFilter so genre filtering always has bipartite genre nodes
  useEffect(() => {
    if (nodeTypeFilter === "genre" && graphMode === "artists") {
      setGraphMode("bipartite");
    }
  }, [nodeTypeFilter, graphMode]);

  const handleGraphModeChange = useCallback(
    (nextMode) => {
      setGraphMode(nextMode);
      if (nextMode === "artists" && nodeTypeFilter === "genre") {
        setNodeTypeFilter("all");
      }
    },
    [nodeTypeFilter]
  );

  const handleNodeTypeFilterChange = useCallback(
    (nextType) => {
      setNodeTypeFilter(nextType);
      if (nextType === "genre" && graphMode === "artists") {
        setGraphMode("bipartite");
      }
    },
    [graphMode]
  );

  // 2. Persist preferences whenever user settings change
  useEffect(() => {
    if (!prefsHydrated) return;
    saveSpacePreferences({
      view_mode: preferredViewMode,
      graph_mode: graphMode,
      time_range: timeRange,
      min_edge_weight: minEdgeWeight,
      node_type_filter: nodeTypeFilter,
      hidden_clusters: hiddenClusters,
      visual_effects: visualEffects,
      recent_planets: recentPlanets,
    });
  }, [
    prefsHydrated,
    preferredViewMode,
    graphMode,
    timeRange,
    minEdgeWeight,
    nodeTypeFilter,
    hiddenClusters,
    visualEffects,
    recentPlanets,
  ]);

  // 3. Check session authentication status
  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/auth/status`, { credentials: "include", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Não foi possível verificar sua sessão.");
        return response.json();
      })
      .then((status) => {
        if (active) setExperience(status.authenticated ? "spotify" : "welcome");
      })
      .catch(() => {
        if (active) setExperience("welcome");
      });
    return () => {
      active = false;
    };
  }, []);

  // 4. Observe stage dimensions
  useEffect(() => {
    const container = graphContainerRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setGraphSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [experience]);

  // 5. Fetch graph data from FastAPI backend
  useEffect(() => {
    if (experience !== "demo" && experience !== "spotify") return undefined;
    let active = true;
    setLoading(true);
    setGraphError(null);
    hasInitialFitRef.current = false;
    setGraphData({ metadata: null, nodes: [], links: [] });
    setSelectedNode(null);
    setHoverNode(null);
    hoverNodeRef.current = null;
    selectedNodeRef.current = null;
    setFocusedClusterId(null);

    const url = `${API_BASE_URL}/api/graph?time_range=${timeRange}&graph_mode=${graphMode}&limit=50&demo=${
      experience === "demo"
    }`;

    fetch(url, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const retryAfter = res.headers.get("Retry-After");
          const waitHint =
            res.status === 429 && /^\d+$/.test(retryAfter || "")
              ? ` Tente novamente em ${retryAfter} segundos.`
              : "";
          const error = new Error(
            (body.detail || `Não foi possível carregar o grafo (${res.status}).`) + waitHint
          );
          error.status = res.status;
          throw error;
        }
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (!Array.isArray(data.nodes) || !Array.isArray(data.links) || !data.metadata) {
          throw new Error("A API retornou um grafo incompleto. Tente novamente.");
        }
        if (typeof Image !== "undefined") {
          data.nodes.forEach((node) => {
            if (node.image_url && !imageCache.current[node.id]) {
              const img = new Image();
              img.crossOrigin = "Anonymous";
              img.src = node.image_url;
              imageCache.current[node.id] = img;
            }
          });
        }
        hasInitialFitRef.current = false;
        setGraphData(data);
        setSelectedNode(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setGraphError({
          message:
            err instanceof TypeError
              ? "Não foi possível conectar ao servidor local. Confira se o backend está em execução."
              : err.message,
          status: err.status || 0,
        });
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [timeRange, graphMode, experience, retryCount]);

  // Reset initial fit guard only when dataset changes
  useEffect(() => {
    hasInitialFitRef.current = false;
  }, [graphData]);

  // 6. Compute motion configuration, filtered graph, centroids, proportional node dimensions, neighborhood, and depth
  const motionConfig = useMemo(
    () =>
      computeMotionConfig({
        prefersReducedMotion,
        userReducedMotion: Boolean(visualEffects?.reduced_motion),
      }),
    [prefersReducedMotion, visualEffects?.reduced_motion]
  );

  useEffect(() => {
    motionConfigRef.current = motionConfig;
  }, [motionConfig]);

  const filteredGraph = useMemo(() => {
    const baseFiltered = filterSpaceGraph(graphData, {
      minEdgeWeight,
      searchQuery,
      nodeTypeFilter,
      hiddenClusters,
      filterNodesBySearch: false,
    });

    // If user filters exclusively by "genre" and baseFiltered.links has no genre-genre edges yet,
    // project shared-artist connections between visible genres so the genre graph renders edges cleanly.
    if (
      nodeTypeFilter === "genre" &&
      baseFiltered.nodes.length > 1 &&
      baseFiltered.links.length === 0 &&
      Array.isArray(graphData?.links) &&
      graphData.links.length > 0
    ) {
      const visibleGenreIds = new Set(baseFiltered.nodes.map((n) => n.id));
      const artistToGenres = new Map();
      for (const l of graphData.links) {
        const sId = typeof l.source === "object" ? l.source?.id : l.source;
        const tId = typeof l.target === "object" ? l.target?.id : l.target;
        if (!sId || !tId) continue;
        const sIsGenre = visibleGenreIds.has(sId);
        const tIsGenre = visibleGenreIds.has(tId);
        if (sIsGenre && !tIsGenre) {
          if (!artistToGenres.has(tId)) artistToGenres.set(tId, []);
          artistToGenres.get(tId).push(sId);
        } else if (tIsGenre && !sIsGenre) {
          if (!artistToGenres.has(sId)) artistToGenres.set(sId, []);
          artistToGenres.get(sId).push(tId);
        }
      }

      const pairCounts = new Map();
      for (const genres of artistToGenres.values()) {
        for (let i = 0; i < genres.length; i++) {
          for (let j = i + 1; j < genres.length; j++) {
            const [gA, gB] =
              genres[i] < genres[j] ? [genres[i], genres[j]] : [genres[j], genres[i]];
            const key = `${gA}__${gB}`;
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
          }
        }
      }

      const projectedLinks = [];
      for (const [key, sharedCount] of pairCounts.entries()) {
        const [source, target] = key.split("__");
        const weight = Number(Math.min(1.0, Math.max(minEdgeWeight, sharedCount * 0.25)).toFixed(4));
        projectedLinks.push({
          source,
          target,
          weight,
          link_type: "genre-genre",
          shared_artists_count: sharedCount,
        });
      }

      return {
        ...baseFiltered,
        links: projectedLinks,
        stats: {
          ...baseFiltered.stats,
          visibleLinks: projectedLinks.length,
        },
      };
    }

    return baseFiltered;
  }, [graphData, minEdgeWeight, searchQuery, nodeTypeFilter, hiddenClusters]);

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return filteredGraph.nodes.filter((n) => filteredGraph.matchedNodeIds.has(n.id));
  }, [filteredGraph, searchQuery]);

  const clusterCentroids = useMemo(
    () =>
      computeClusterCentroids(
        graphData.metadata?.clusters || [],
        graphData.metadata?.modularity_score || 0
      ),
    [graphData.metadata]
  );

  // Compute proportional listening dimensions D_i = D_max * (L_i / L_max) and R_i = D_i / 2
  const visualPropsByNodeId = useMemo(() => {
    const allNodes = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
    const proportionalMap =
      typeof computeListeningProportionalDimensions === "function"
        ? computeListeningProportionalDimensions(allNodes, {
            maxArtistListeningCount: graphData.metadata?.max_artist_listening_count,
            maxGenreListeningCount: graphData.metadata?.max_genre_listening_count,
          })
        : new Map();

    let maxArtistListening = 1;
    let maxGenreListening = 1;

    const artistSorted = [];
    const genreSorted = [];

    for (const n of allNodes) {
      const count = extractRawListeningCount(n);
      if (n?.node_type === "genre") {
        if (count > maxGenreListening) maxGenreListening = count;
        genreSorted.push({ id: n.id, count, name: n.name || "" });
      } else {
        if (count > maxArtistListening) maxArtistListening = count;
        artistSorted.push({ id: n.id, count, name: n.name || "" });
      }
    }

    artistSorted.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    genreSorted.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const rankById = new Map();
    artistSorted.forEach((item, idx) => rankById.set(item.id, idx + 1));
    genreSorted.forEach((item, idx) => rankById.set(item.id, idx + 1));

    const map = new Map();
    const D_max_artist = graphMode === "bipartite" ? 24.0 : 28.0;
    const D_max_genre = 30.0;

    for (const node of allNodes) {
      const propEntry = proportionalMap.get ? proportionalMap.get(node.id) : null;
      const baseProps = computePlanetVisualProps(
        node,
        graphData.metadata,
        graphMode,
        graphData.links
      );
      const isGenre = node?.node_type === "genre";
      const L_i =
        propEntry && !propEntry.isFallbackListening && propEntry.listeningCount > 0
          ? propEntry.listeningCount
          : Number.isFinite(baseProps.listeningCount) && baseProps.listeningCount > 0
          ? baseProps.listeningCount
          : extractRawListeningCount(node);
      const L_max = isGenre ? maxGenreListening : maxArtistListening;
      const ratio =
        propEntry && !propEntry.isFallbackListening && propEntry.listeningRatio > 0
          ? propEntry.listeningRatio
          : Number.isFinite(baseProps.listeningRatio) && baseProps.listeningRatio > 0
          ? baseProps.listeningRatio
          : Number(Math.min(1.0, Math.max(0.05, L_i / Math.max(1, L_max))).toFixed(4));

      const D_max = isGenre ? D_max_genre : D_max_artist;
      const diameter =
        propEntry && !propEntry.isFallbackListening && propEntry.dimension > 0
          ? propEntry.dimension
          : Number.isFinite(baseProps.dimension) && baseProps.dimension > 0
          ? baseProps.dimension
          : D_max * ratio;
      const radius =
        propEntry && !propEntry.isFallbackListening && propEntry.radius > 0
          ? propEntry.radius
          : Number.isFinite(baseProps.radius) && baseProps.radius > 0
          ? Number(baseProps.radius)
          : diameter / 2;
      const rank =
        propEntry?.listeningRank ??
        baseProps.listeningRank ??
        node?.listening_rank ??
        node?.affinity_rank ??
        rankById.get(node.id) ??
        1;

      const rawObserved =
        node.observed_plays ??
        node.observedPlays ??
        propEntry?.observed_plays ??
        propEntry?.observedPlays ??
        baseProps.observed_plays ??
        baseProps.observedPlays ??
        0;
      const observed_plays =
        Number.isFinite(Number(rawObserved)) && Number(rawObserved) >= 0
          ? Number(rawObserved)
          : 0;

      const rawSaved =
        node.saved_tracks_count ??
        node.savedTracksCount ??
        propEntry?.saved_tracks_count ??
        baseProps.saved_tracks_count ??
        0;
      const saved_tracks_count =
        Number.isFinite(Number(rawSaved)) && Number(rawSaved) >= 0
          ? Number(rawSaved)
          : 0;

      const rawTopCount =
        node.top_tracks_count ??
        node.topTracksCount ??
        propEntry?.top_tracks_count ??
        baseProps.top_tracks_count ??
        (Array.isArray(node.top_tracks) ? node.top_tracks.length : 0);
      const top_tracks_count =
        Number.isFinite(Number(rawTopCount)) && Number(rawTopCount) >= 0
          ? Number(rawTopCount)
          : 0;

      const listening_metric_type =
        node.listening_metric_type ??
        propEntry?.listening_metric_type ??
        baseProps.listening_metric_type ??
        (observed_plays > 0 ? "observed_plays" : "estimated_listening_index");

      const listening_metric_label =
        node.listening_metric_label ??
        propEntry?.listening_metric_label ??
        baseProps.listening_metric_label ??
        (observed_plays > 0 ? "Reproduções Observadas" : "Índice Estimado de Escuta");

      const listening_source =
        node.listening_source ??
        propEntry?.listening_source ??
        baseProps.listening_source ??
        (observed_plays > 0 ? "recent_playback_history" : "spotify_top_affinity");

      const listening_period =
        node.listening_period ??
        propEntry?.listening_period ??
        baseProps.listening_period ??
        (observed_plays > 0 ? "historico_observado" : timeRange);

      map.set(node.id, {
        ...baseProps,
        radius,
        diameter,
        dimension: diameter,
        listening_count: L_i,
        listeningCount: L_i,
        listening_max: L_max,
        listening_ratio: ratio,
        listeningRatio: ratio,
        listening_rank: rank,
        listeningRank: rank,
        observed_plays,
        observedPlays: observed_plays,
        saved_tracks_count,
        savedTracksCount: saved_tracks_count,
        top_tracks_count,
        topTracksCount: top_tracks_count,
        listening_metric_type,
        listeningMetricType: listening_metric_type,
        listening_metric_label,
        listeningMetricLabel: listening_metric_label,
        listening_source,
        listeningSource: listening_source,
        listening_period,
        listeningPeriod: listening_period,
      });
    }

    return map;
  }, [graphData.nodes, graphData.links, graphData.metadata, graphMode, timeRange]);

  useEffect(() => {
    visualPropsByNodeIdRef.current = visualPropsByNodeId;
  }, [visualPropsByNodeId]);

  const rawActiveNode = hoverNode || selectedNode;

  const activeNode = useMemo(() => {
    if (!rawActiveNode) return null;
    const vProps = visualPropsByNodeId.get(rawActiveNode.id);
    if (!vProps) return rawActiveNode;
    return {
      ...rawActiveNode,
      listening_count: rawActiveNode.listening_count ?? vProps.listening_count,
      listening_ratio: rawActiveNode.listening_ratio ?? vProps.listening_ratio,
      listening_rank: rawActiveNode.listening_rank ?? vProps.listening_rank,
      diameter: rawActiveNode.diameter ?? vProps.diameter,
      radius: rawActiveNode.radius ?? vProps.radius,
      observed_plays: rawActiveNode.observed_plays ?? vProps.observed_plays,
      saved_tracks_count: rawActiveNode.saved_tracks_count ?? vProps.saved_tracks_count,
      top_tracks_count: rawActiveNode.top_tracks_count ?? vProps.top_tracks_count,
      listening_metric_type: rawActiveNode.listening_metric_type ?? vProps.listening_metric_type,
      listening_metric_label: rawActiveNode.listening_metric_label ?? vProps.listening_metric_label,
      listening_source: rawActiveNode.listening_source ?? vProps.listening_source,
      listening_period: rawActiveNode.listening_period ?? vProps.listening_period,
    };
  }, [rawActiveNode, visualPropsByNodeId]);

  const computeNeighborhoodWithFallback = useCallback(
    (targetId) => {
      if (!targetId) {
        return {
          nodeId: null,
          targetNode: null,
          directConnections: [],
          indirectConnections: [],
          highlightNodeIds: new Set(),
          highlightLinkKeys: new Set(),
        };
      }
      // Pass full graphData as 4th argument so genre inspector receives all connected artists
      const primary = computeNodeNeighborhood(
        targetId,
        filteredGraph,
        graphMode,
        graphData
      );
      if (
        primary.directConnections.length === 0 &&
        Array.isArray(graphData?.nodes) &&
        graphData.nodes.length > 0
      ) {
        return computeNodeNeighborhood(targetId, graphData, graphMode, graphData);
      }
      return primary;
    },
    [filteredGraph, graphMode, graphData]
  );

  const neighborhood = useMemo(
    () => computeNeighborhoodWithFallback(activeNode?.id || null),
    [activeNode, computeNeighborhoodWithFallback]
  );

  useEffect(() => {
    activeNeighborhoodRef.current = neighborhood;
  }, [neighborhood]);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  const handleNodeHover = useCallback(
    (node) => {
      const nextNode = node || null;
      const prevId = hoverNodeRef.current?.id || null;
      const nextId = nextNode?.id || null;
      if (prevId === nextId) return;

      hoverNodeRef.current = nextNode;
      const targetId = nextId || selectedNodeRef.current?.id || null;
      activeNeighborhoodRef.current = computeNeighborhoodWithFallback(targetId);
      setHoverNode(nextNode);
    },
    [computeNeighborhoodWithFallback]
  );

  // Expose telemetry/test bridge for E2E verification of 3D camera stability and node dimensions
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.__BEATCODE_GRAPH_API__ = {
      getCameraState: () => {
        const cam =
          typeof fg3dRef.current?.camera === "function" ? fg3dRef.current.camera() : null;
        const pos = cam?.position || { x: 0, y: 0, z: 0 };
        const dist = Math.hypot(pos.x || 0, pos.y || 0, pos.z || 0);
        const zoom2d =
          typeof fg2dRef.current?.zoom === "function" ? fg2dRef.current.zoom() : null;
        return {
          x: Number(pos.x || 0),
          y: Number(pos.y || 0),
          z: Number(pos.z || 0),
          distance: Number(dist),
          zoom2d,
          hoverNodeId: hoverNodeRef.current?.id || null,
          selectedNodeId: selectedNodeRef.current?.id || null,
        };
      },
      triggerHoverNodeById: (nodeId) => {
        if (!nodeId) {
          handleNodeHover(null);
          return null;
        }
        const target =
          filteredGraph.nodes.find((n) => n.id === nodeId) ||
          graphData.nodes.find((n) => n.id === nodeId) ||
          null;
        handleNodeHover(target);
        return target ? target.id : null;
      },
      getNodeVisualProps: (nodeId) => visualPropsByNodeIdRef.current.get(nodeId) || null,
      getFilteredStats: () => ({
        graphMode,
        nodeTypeFilter,
        visibleNodes: filteredGraph.nodes.length,
        visibleLinks: filteredGraph.links.length,
        linkTypes: Array.from(new Set(filteredGraph.links.map((l) => l.link_type || "default"))),
      }),
    };
    return () => {
      delete window.__BEATCODE_GRAPH_API__;
    };
  }, [filteredGraph, graphData.nodes, graphMode, nodeTypeFilter, handleNodeHover]);

  const explorationDepth = useMemo(
    () =>
      deriveExplorationDepth({
        selectedNode,
        focusedClusterId,
      }),
    [selectedNode, focusedClusterId]
  );

  // 7. Dispose Three.js GPU resources on unmount or when leaving 3D mode / changing dataset
  useEffect(() => {
    const registry = resourceRegistryRef.current;
    return () => {
      disposeThreeUniverse(sceneRef.current, registry);
      starfieldObjectRef.current = null;
    };
  }, [graphData, viewMode]);

  // 8. Configure 3D forces & clean Graphify stage when 3D graph is active
  useEffect(() => {
    if (viewMode !== "space_3d" || !webglHealthy || !fg3dRef.current) return;
    const fg3d = fg3dRef.current;
    configureSpaceForces3D(fg3d, {
      graphMode,
      clusterCentroids,
      nodes: filteredGraph.nodes,
    });

    if (typeof fg3d.scene === "function") {
      const scene = fg3d.scene();
      sceneRef.current = scene;
      if (scene) {
        if (starfieldObjectRef.current && typeof scene.remove === "function") {
          scene.remove(starfieldObjectRef.current);
          starfieldObjectRef.current = null;
        }
        const stageGroup = createCosmicStarfield(0, 1400, resourceRegistryRef.current);
        starfieldObjectRef.current = stageGroup;
        if (typeof scene.add === "function") {
          scene.add(stageGroup);
        }
      }
    }
  }, [
    viewMode,
    webglHealthy,
    graphMode,
    clusterCentroids,
    filteredGraph.nodes,
  ]);

  // 9. Sync 3D OrbitControls autoRotate with motionConfig & autoRotate toggle
  useEffect(() => {
    if (viewMode !== "space_3d" || !fg3dRef.current) return;
    const controls =
      typeof fg3dRef.current.controls === "function" ? fg3dRef.current.controls() : null;
    if (controls) {
      controls.autoRotate = Boolean(autoRotate && !motionConfig.reducedMotion);
      controls.autoRotateSpeed = motionConfig.autoRotateSpeed || 0.6;
    }
  }, [viewMode, autoRotate, motionConfig]);

  // 10. Attach WebGL context loss / restoration listeners to the active 3D canvas
  useEffect(() => {
    if (viewMode !== "space_3d" || !graphContainerRef.current) return undefined;
    const container = graphContainerRef.current;
    let detachFn = null;

    const timer = requestAnimationFrame(() => {
      const canvas = container.querySelector("canvas");
      if (!canvas) return;
      detachFn = attachWebGLContextListeners(canvas, {
        onContextLost: () => {
          disposeThreeUniverse(sceneRef.current, resourceRegistryRef.current);
          const next = resolveWebGLFallbackState(
            {
              viewMode,
              preferredViewMode,
              selectedNodeId: selectedNode?.id ?? null,
              minEdgeWeight,
              searchQuery,
              hiddenClusters: new Set(hiddenClusters),
            },
            "webglcontextlost"
          );
          setWebglHealthy(false);
          setViewMode(next.viewMode);
          setStatusBanner(next.statusBanner);
        },
        onContextRestored: () => {
          const next = resolveWebGLFallbackState(
            {
              viewMode: "map_2d",
              preferredViewMode,
              selectedNodeId: selectedNode?.id ?? null,
              minEdgeWeight,
              searchQuery,
              hiddenClusters: new Set(hiddenClusters),
            },
            "webglcontextrestored"
          );
          setWebglHealthy(true);
          setViewMode(next.viewMode);
          setStatusBanner(next.statusBanner);
        },
      });
    });

    return () => {
      cancelAnimationFrame(timer);
      if (typeof detachFn === "function") detachFn();
    };
  }, [
    viewMode,
    preferredViewMode,
    selectedNode?.id,
    minEdgeWeight,
    searchQuery,
    hiddenClusters,
    filteredGraph.nodes.length,
  ]);

  // 11. Configure 2D forces when in 2D map mode
  useEffect(() => {
    if (viewMode !== "map_2d" || !fg2dRef.current) return;
    fg2dRef.current.d3Force("charge")?.strength(graphMode === "bipartite" ? -210 : -260);
    fg2dRef.current
      .d3Force("link")
      ?.distance((link) =>
        graphMode === "bipartite" ? 85 : 115 * (1.15 - (link.weight || 0.2))
      );
    fg2dRef.current.d3Force(
      "collide",
      d3.forceCollide((node) => (visualPropsByNodeIdRef.current.get(node.id)?.radius || node.val || 10) + 6)
    );
  }, [viewMode, graphData, graphMode]);

  // 12. Keyboard shortcuts: "/" focuses search input; "Escape" clears selection
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleKeyDown = (event) => {
      const tag = event.target?.tagName;
      const isEditingInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (event.key === "/" && !isEditingInput) {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key === "Escape") {
        if (searchQuery) {
          setSearchQuery("");
        } else {
          setSelectedNode(null);
          setFocusedClusterId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery]);

  // 13. Camera flight & selection helpers
  const flyCameraToNode = useCallback(
    (node) => {
      if (!node) return;
      if (viewMode === "space_3d" && fg3dRef.current) {
        const target = resolveCameraFlightTarget({
          action: "focus_planet",
          node,
          reducedMotion: motionConfig.reducedMotion,
        });
        if (typeof fg3dRef.current.cameraPosition === "function") {
          fg3dRef.current.cameraPosition(
            target.position,
            target.lookAt,
            target.transitionMs
          );
        }
      } else if (fg2dRef.current) {
        const ms = motionConfig.reducedMotion ? 0 : 400;
        if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
          fg2dRef.current.centerAt(node.x, node.y, ms);
        }
        fg2dRef.current.zoom(2.1, ms);
      }
    },
    [viewMode, motionConfig.reducedMotion]
  );

  // Select node by object or ID, searching both filteredGraph.nodes and full graphData.nodes
  const handleSelectAndFocusNode = useCallback(
    (nodeOrId) => {
      if (!nodeOrId) return;
      const targetId = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
      const resolved =
        filteredGraph.nodes.find((n) => n.id === targetId) ||
        graphData.nodes.find((n) => n.id === targetId) ||
        (typeof nodeOrId === "object" ? nodeOrId : null);

      if (!resolved) return;

      // If the selected node was hidden by the current type filter (e.g. clicking a connected artist while viewing genres), reveal it
      const resolvedType = resolved.node_type || "artist";
      if (nodeTypeFilter !== "all" && nodeTypeFilter !== resolvedType) {
        setNodeTypeFilter("all");
      }
      if (
        resolved.cluster_id !== undefined &&
        hiddenClusters.includes(resolved.cluster_id)
      ) {
        setHiddenClusters((prev) => prev.filter((id) => id !== resolved.cluster_id));
      }

      selectedNodeRef.current = resolved;
      setSelectedNode(resolved);
      setFocusedClusterId(null);
      const updatedPrefs = recordVisitedPlanet(resolved);
      setRecentPlanets(updatedPrefs.recent_planets || []);
      flyCameraToNode(resolved);
    },
    [
      filteredGraph.nodes,
      graphData.nodes,
      nodeTypeFilter,
      hiddenClusters,
      flyCameraToNode,
    ]
  );

  const handleFocusCluster = useCallback(
    (cluster) => {
      if (!cluster) return;
      const clusterId = cluster.cluster_id;
      setSelectedNode(null);
      selectedNodeRef.current = null;
      setFocusedClusterId(clusterId);

      const centroid = clusterCentroids.get(clusterId);
      if (viewMode === "space_3d" && fg3dRef.current && centroid) {
        const target = resolveCameraFlightTarget({
          action: "focus_cluster",
          clusterCentroid: centroid,
          reducedMotion: motionConfig.reducedMotion,
        });
        if (typeof fg3dRef.current.cameraPosition === "function") {
          fg3dRef.current.cameraPosition(
            target.position,
            target.lookAt,
            target.transitionMs
          );
        }
      } else if (fg2dRef.current) {
        const ms = motionConfig.reducedMotion ? 0 : 350;
        fg2dRef.current.zoomToFit(ms, 48, (n) => n.cluster_id === clusterId);
      }
    },
    [clusterCentroids, viewMode, motionConfig.reducedMotion]
  );

  const handleResetOverview = useCallback(() => {
    hasInitialFitRef.current = false;
    setSelectedNode(null);
    selectedNodeRef.current = null;
    setFocusedClusterId(null);
    const ms = motionConfig.reducedMotion ? 0 : 800;

    if (viewMode === "space_3d" && fg3dRef.current) {
      const target = resolveCameraFlightTarget({
        action: "overview",
        reducedMotion: motionConfig.reducedMotion,
      });
      if (typeof fg3dRef.current.cameraPosition === "function") {
        fg3dRef.current.cameraPosition(
          target.position,
          target.lookAt,
          target.transitionMs
        );
      }
      if (typeof fg3dRef.current.zoomToFit === "function") {
        fg3dRef.current.zoomToFit(ms, 40);
      }
      hasInitialFitRef.current = true;
    } else if (fg2dRef.current) {
      fg2dRef.current.zoomToFit(ms, 36);
      hasInitialFitRef.current = true;
    }
  }, [viewMode, motionConfig.reducedMotion]);

  const handleZoomIn = useCallback(() => {
    const ms = motionConfig.reducedMotion ? 0 : 250;
    if (viewMode === "space_3d" && fg3dRef.current?.camera) {
      const cam = fg3dRef.current.camera();
      if (cam?.position && typeof fg3dRef.current.cameraPosition === "function") {
        fg3dRef.current.cameraPosition(
          {
            x: cam.position.x * 0.78,
            y: cam.position.y * 0.78,
            z: cam.position.z * 0.78,
          },
          undefined,
          ms
        );
      }
    } else if (fg2dRef.current) {
      const curZoom = fg2dRef.current.zoom() || 1;
      fg2dRef.current.zoom(curZoom * 1.3, ms);
    }
  }, [viewMode, motionConfig.reducedMotion]);

  const handleZoomOut = useCallback(() => {
    const ms = motionConfig.reducedMotion ? 0 : 250;
    if (viewMode === "space_3d" && fg3dRef.current?.camera) {
      const cam = fg3dRef.current.camera();
      if (cam?.position && typeof fg3dRef.current.cameraPosition === "function") {
        fg3dRef.current.cameraPosition(
          {
            x: cam.position.x * 1.28,
            y: cam.position.y * 1.28,
            z: cam.position.z * 1.28,
          },
          undefined,
          ms
        );
      }
    } else if (fg2dRef.current) {
      const curZoom = fg2dRef.current.zoom() || 1;
      fg2dRef.current.zoom(curZoom / 1.3, ms);
    }
  }, [viewMode, motionConfig.reducedMotion]);

  const handleToggleClusterVisibility = useCallback((clusterId) => {
    setHiddenClusters((prev) => {
      const exists = prev.includes(clusterId);
      if (exists) {
        return prev.filter((id) => id !== clusterId);
      }
      return [...prev, clusterId];
    });
  }, []);

  const handleToggleVisualEffect = useCallback((effectKey) => {
    setVisualEffects((prev) => ({
      ...prev,
      [effectKey]: !prev?.[effectKey],
    }));
  }, []);

  const handleViewModeChange = useCallback((nextMode) => {
    setPreferredViewMode(nextMode);
    if (nextMode === "space_3d" && !detectWebGLSupport()) {
      const fb = resolveWebGLFallbackState(
        { viewMode: "map_2d", preferredViewMode: "space_3d" },
        "webgl_unsupported"
      );
      setViewMode("map_2d");
      setWebglHealthy(false);
      setStatusBanner(fb.statusBanner);
      return;
    }
    setViewMode(nextMode);
  }, []);

  // 14. Stable 3D Node renderer & sanitized Graphify tooltip (independent of hoverNode state)
  const renderNodeThreeObject = useCallback(
    (node) => {
      const visualProps =
        visualPropsByNodeId.get(node.id) ||
        computePlanetVisualProps(node, graphData.metadata, graphMode, filteredGraph.links);
      return createPlanetObject3D(
        node,
        visualProps,
        {
          metadata: graphData.metadata,
          graphMode,
          links: filteredGraph.links,
        },
        resourceRegistryRef.current
      );
    },
    [visualPropsByNodeId, graphData.metadata, graphMode, filteredGraph.links]
  );

  const renderNodeLabel3D = useCallback((node) => {
    const safeName = escapeHtml(node?.name || "Desconhecido");
    const isGenre = node?.node_type === "genre";
    const vProps = visualPropsByNodeIdRef.current.get(node?.id) || {};
    const metricType =
      vProps.listening_metric_type ||
      node?.listening_metric_type ||
      (Number(vProps.observed_plays ?? node?.observed_plays ?? 0) > 0
        ? "observed_plays"
        : "estimated_listening_index");
    const listeningCount =
      vProps.listening_count ?? node?.listening_count ?? extractRawListeningCount(node);
    const metricLabel =
      metricType === "observed_plays"
        ? `Reproduções Observadas (L_i): <strong style="color:#4ade80;">${escapeHtml(listeningCount)}</strong>`
        : `Índice Estimado (L_i): <strong style="color:#4ade80;">${escapeHtml(listeningCount)} pts</strong>`;

    const affinityRank =
      vProps.affinity_rank ?? node?.affinity_rank ?? vProps.listening_rank ?? node?.listening_rank ?? "—";
    const rawAffScore = vProps.affinity_score ?? node?.affinity_score ?? null;
    const affinityScorePct =
      rawAffScore !== null && rawAffScore !== undefined
        ? `${Math.round(Number(rawAffScore) * 100)}%`
        : null;
    const affinityText =
      affinityScorePct !== null
        ? `#${escapeHtml(affinityRank)} (${escapeHtml(affinityScorePct)})`
        : `#${escapeHtml(affinityRank)}`;

    const savedTracksCount =
      vProps.saved_tracks_count ?? node?.saved_tracks_count ?? 0;

    const ratioPct = Number(
      ((vProps.listening_ratio ?? node?.listening_ratio ?? 0.5) * 100)
    ).toFixed(1);
    const diameter = Number(
      vProps.diameter ?? node?.diameter ?? (vProps.radius ? vProps.radius * 2 : 10)
    ).toFixed(2);
    const typeLabel = isGenre ? "Hub Semântico · Gênero" : "Nó do Grafo · Artista";

    return `<div style="padding:8px 11px;border-radius:10px;background:rgba(9,13,22,0.95);border:1px solid rgba(29,185,84,0.5);color:#f8fafc;font-family:system-ui,sans-serif;font-size:12px;line-height:1.45;min-width:210px;">
      <strong style="display:block;color:#ffffff;font-size:13px;">${safeName}</strong>
      <span style="color:#4ade80;font-size:11px;font-weight:600;">${typeLabel}</span>
      <div style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(148,163,184,0.2);color:#cbd5e1;font-size:11px;">
        <div>${metricLabel}</div>
        <div>Afinidade Spotify: <strong style="color:#38bdf8;">${affinityText}</strong></div>
        <div>Biblioteca: <strong style="color:#a78bfa;">${escapeHtml(savedTracksCount)} faixas salvas</strong></div>
        <div>Proporção (L_i/L_max): <strong style="color:#4ade80;">${escapeHtml(ratioPct)}%</strong></div>
        <div>Dimensão 3D (D_i): <strong style="color:#f8fafc;">${escapeHtml(diameter)}</strong></div>
      </div>
    </div>`;
  }, []);

  // 15. Stable 2D Canvas Node Painter (reads hover/active refs without recreating callback)
  const paintNode2D = useCallback((node, ctx, globalScale) => {
    if (node.x === undefined || node.y === undefined) return;

    const currentActive = hoverNodeRef.current || selectedNodeRef.current;
    const highlightSet = activeNeighborhoodRef.current?.highlightNodeIds;
    const isHighlighted =
      !currentActive || (highlightSet && highlightSet.has(node.id));
    const isFocused = currentActive && currentActive.id === node.id;
    const vProps = visualPropsByNodeIdRef.current.get(node.id);
    const radius = vProps?.radius || node.val || 8;

    ctx.save();
    ctx.globalAlpha = isHighlighted ? 1.0 : 0.18;

    if (isFocused) {
      ctx.shadowColor = node.color || "#1DB954";
      ctx.shadowBlur = 18;
    }

    if (node.node_type === "genre") {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const hx = node.x + radius * Math.cos(angle);
        const hy = node.y + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fillStyle = "#0b1320";
      ctx.fill();
      ctx.lineWidth = isFocused ? 3 / globalScale : 2 / globalScale;
      ctx.strokeStyle = node.color || "#38bdf8";
      ctx.stroke();

      const fontSize = Math.max(9.5 / globalScale, 3.2);
      ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = node.color || "#38bdf8";
      ctx.fillText(`# ${node.name}`, node.x, node.y);
    } else {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
      ctx.closePath();
      ctx.fillStyle = node.color || "#1DB954";
      ctx.fill();
      ctx.lineWidth = isFocused ? 3 / globalScale : 1.8 / globalScale;
      ctx.strokeStyle = isFocused ? "#ffffff" : "rgba(255,255,255,0.35)";
      ctx.stroke();

      if (globalScale >= 0.9 || (currentActive && isHighlighted)) {
        const fontSize = Math.max(11 / globalScale, 3.5);
        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#F9FAFB";
        ctx.fillText(node.name, node.x, node.y + radius + 4 / globalScale);
      }
    }

    ctx.restore();
  }, []);

  // 16. Stable Link styling callbacks (use refs so hover never recreates ForceGraph props)
  const isLinkHighlighted = useCallback((link) => {
    const currentActive = hoverNodeRef.current || selectedNodeRef.current;
    if (!currentActive) return false;
    const sId = typeof link.source === "object" ? link.source?.id : link.source;
    const tId = typeof link.target === "object" ? link.target?.id : link.target;
    return Boolean(
      activeNeighborhoodRef.current?.highlightLinkKeys?.has(`${sId}__${tId}`)
    );
  }, []);

  const getLinkWidth = useCallback(
    (link) => {
      const w = Number.isFinite(link?.weight) ? link.weight : 0.2;
      return isLinkHighlighted(link) ? Math.max(1.8, w * 4.2) : Math.max(0.7, w * 1.8);
    },
    [isLinkHighlighted]
  );

  const getLinkColor = useCallback(
    (link) => {
      const currentActive = hoverNodeRef.current || selectedNodeRef.current;
      if (!currentActive) return "rgba(148, 163, 184, 0.28)";
      return isLinkHighlighted(link)
        ? "rgba(29, 185, 84, 0.92)"
        : "rgba(71, 85, 105, 0.12)";
    },
    [isLinkHighlighted]
  );

  const getLinkParticles = useCallback(
    (link) => {
      const cfg = motionConfigRef.current;
      if (cfg.reducedMotion || cfg.directionalParticles === 0) {
        return 0;
      }
      return isLinkHighlighted(link) ? 2 : 0;
    },
    [isLinkHighlighted]
  );

  const getNodeVal = useCallback(
    (node) => visualPropsByNodeId.get(node.id)?.radius || node.val || 8,
    [visualPropsByNodeId]
  );

  // 17. Session logout / leave handler
  const leaveGraph = async () => {
    if (experience === "spotify") {
      setLoggingOut(true);
      try {
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
        }
      } catch (error) {
        setGraphError({ message: error.message, status: 0 });
        setLoggingOut(false);
        return;
      }
      setLoggingOut(false);
    }
    disposeThreeUniverse(sceneRef.current, resourceRegistryRef.current);
    hasInitialFitRef.current = false;
    setGraphData({ metadata: null, nodes: [], links: [] });
    setSelectedNode(null);
    selectedNodeRef.current = null;
    setHoverNode(null);
    hoverNodeRef.current = null;
    setFocusedClusterId(null);
    setGraphError(null);
    setExperience("welcome");
  };

  if (experience === "checking") {
    return (
      <div
        className="space-universe-stage flex min-h-dvh items-center justify-center text-zinc-300"
        role="status"
      >
        Verificando sessão...
      </div>
    );
  }

  if (experience === "welcome") {
    return (
      <main className="beatcode-welcome space-universe-stage min-h-dvh overflow-y-auto text-zinc-100">
        <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-6 py-7 sm:px-10">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-zinc-300">
            <span
              className="h-3 w-3 rounded-full bg-[#1DB954] shadow-[0_0_22px_#1DB954]"
              aria-hidden="true"
            />
            BeatCode <span className="text-[#1DB954]">Graphify 3D</span>{" "}
            <span className="font-normal text-zinc-500">/ grafo de conhecimento musical</span>
          </div>
          <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="relative z-10 max-w-xl">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
                Topologia proporcional às suas escutas
              </p>
              <h1 className="text-5xl font-black leading-[0.98] tracking-[-0.06em] sm:text-7xl">
                Mapeie as conexões.
                <br />
                <span className="text-[#1DB954]">Explore o Grafo 3D.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-zinc-400">
                Navegue por nós de artistas, hubs semânticos de gêneros, clusters Louvain e arestas
                ponderadas em um grafo de conhecimento 3D e 2D inspirado no Graphify.
              </p>
              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                <a
                  href={`${API_BASE_URL}/auth/login`}
                  data-testid="connect-spotify-btn"
                  className="group rounded-2xl border border-emerald-500/40 bg-emerald-500 p-5 text-zinc-950 shadow-[0_12px_50px_rgba(29,185,84,0.16)] transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  <span className="text-xs font-bold uppercase tracking-widest">Sua biblioteca</span>
                  <strong className="mt-5 block text-xl leading-tight">
                    Conectar com Spotify ↗
                  </strong>
                  <span className="mt-3 block text-sm text-emerald-950/80">
                    Entre com sua conta para gerar seu grafo 3D de artistas, gêneros e clusters.
                  </span>
                </a>
                <button
                  type="button"
                  data-testid="enter-demo-btn"
                  onClick={() => setExperience("demo")}
                  className="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5 text-left transition hover:border-amber-400/70 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                    Sem login
                  </span>
                  <strong className="mt-5 block text-xl leading-tight text-zinc-100">
                    Explorar demonstração →
                  </strong>
                  <span className="mt-3 block text-sm text-zinc-400">
                    Experimente o Grafo de Conhecimento 3D e 2D com dados verificados de exemplo.
                  </span>
                </button>
              </div>
              <p className="mt-5 text-xs text-zinc-500">
                Suas credenciais Spotify não são expostas ao cliente. A demonstração não requer conta.
              </p>
            </div>
            <div
              className="constellation-preview relative min-h-[360px] lg:min-h-[620px]"
              aria-hidden="true"
            >
              <div className="preview-orbit preview-orbit-one" />
              <div className="preview-orbit preview-orbit-two" />
              <span className="preview-node preview-node-a">A</span>
              <span className="preview-node preview-node-b">B</span>
              <span className="preview-node preview-node-c">C</span>
              <span className="preview-node preview-node-d">D</span>
              <span className="preview-node preview-node-e">E</span>
              <span className="preview-node preview-node-f">#</span>
              <span className="preview-caption">NÓS · ARTÍSTAS · GÊNEROS · CLUSTERS · ARESTAS</span>
            </div>
          </div>
          <p className="text-xs text-zinc-600">
            BeatCode Graphify 3D diferencia explicitamente dados medidos pelo Spotify de inferências topológicas.
          </p>
        </div>
      </main>
    );
  }

  const render3DActive = viewMode === "space_3d" && webglHealthy;

  return (
    <div className="flex h-dvh w-full flex-col overflow-y-auto bg-[#05070d] font-sans text-zinc-100 lg:overflow-hidden">
      {/* Barra Superior do Grafo de Conhecimento 3D, Busca, Filtros e Controles de Câmera */}
      <SpaceHudControls
        viewMode={render3DActive ? "space_3d" : "map_2d"}
        onViewModeChange={handleViewModeChange}
        graphMode={graphMode}
        onGraphModeChange={handleGraphModeChange}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        minEdgeWeight={minEdgeWeight}
        onMinEdgeWeightChange={setMinEdgeWeight}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchInputRef={searchInputRef}
        searchMatches={searchMatches}
        onSelectSearchNode={(node) => {
          handleSelectAndFocusNode(node);
          setSearchQuery("");
        }}
        nodeTypeFilter={nodeTypeFilter}
        onNodeTypeFilterChange={handleNodeTypeFilterChange}
        explorationDepth={explorationDepth}
        selectedNode={selectedNode}
        onCenterSelected={() => selectedNode && flyCameraToNode(selectedNode)}
        onResetOverview={handleResetOverview}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        visualEffects={visualEffects}
        onToggleVisualEffect={handleToggleVisualEffect}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate((prev) => !prev)}
        showLegend={showLegend}
        onToggleLegend={() => setShowLegend((prev) => !prev)}
        statusBanner={statusBanner}
        onDismissBanner={() => setStatusBanner(null)}
        isDemo={experience === "demo"}
        onExitDemo={leaveGraph}
        onLogout={leaveGraph}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Palco do Grafo de Conhecimento (3D WebGL ou 2D) */}
        <main
          ref={graphContainerRef}
          data-testid="beatcode-space-stage"
          className="space-universe-stage relative min-h-[54vh] min-w-0 flex-1 overflow-hidden lg:min-h-0"
          aria-label="Grafo de Conhecimento 3D BeatCode"
        >
          {loading ? (
            <div
              className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-300"
              role="status"
            >
              Construindo Grafo de Conhecimento 3D, calculando proporções de escuta e clusters...
            </div>
          ) : graphError ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="max-w-md text-sm text-zinc-200" role="alert">
                {graphError.message}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRetryCount((count) => count + 1)}
                  className="rounded-xl border border-zinc-700 px-5 py-2.5 text-xs font-semibold hover:bg-zinc-800"
                >
                  Tentar novamente
                </button>
                {graphError.status === 401 && experience === "spotify" && (
                  <a
                    href={`${API_BASE_URL}/auth/login`}
                    className="rounded-xl bg-[#1DB954] px-5 py-2.5 text-xs font-bold text-black"
                  >
                    Reconectar Spotify
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setExperience("demo")}
                  className="rounded-xl border border-amber-500/60 px-5 py-2.5 text-xs font-semibold text-amber-300"
                >
                  Explorar demonstração
                </button>
              </div>
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div
              className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400"
              role="status"
            >
              Nenhum nó de artista encontrado neste período. Escolha outro intervalo para explorar.
            </div>
          ) : filteredGraph.nodes.length === 0 ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-zinc-300"
              role="status"
            >
              <p>Nenhum nó (artista ou gênero) visível com os filtros atuais.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setNodeTypeFilter("all");
                  setHiddenClusters([]);
                }}
                className="rounded-xl border border-emerald-500/50 bg-emerald-950/40 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50"
              >
                Restaurar filtros do grafo
              </button>
            </div>
          ) : render3DActive ? (
            <ForceGraph3D
              ref={fg3dRef}
              width={graphSize.width}
              height={graphSize.height}
              graphData={filteredGraph}
              backgroundColor="#05070d"
              showNavInfo={false}
              nodeRelSize={1}
              nodeVal={getNodeVal}
              nodeThreeObject={renderNodeThreeObject}
              nodeThreeObjectExtend={false}
              nodeLabel={renderNodeLabel3D}
              onNodeHover={handleNodeHover}
              onNodeClick={handleSelectAndFocusNode}
              onBackgroundClick={() => {
                setSelectedNode(null);
                selectedNodeRef.current = null;
                setFocusedClusterId(null);
              }}
              linkWidth={getLinkWidth}
              linkColor={getLinkColor}
              linkOpacity={0.62}
              linkDirectionalParticles={getLinkParticles}
              linkDirectionalParticleWidth={2.2}
              cooldownTicks={100}
              onEngineStop={() => {
                if (
                  !hasInitialFitRef.current &&
                  !selectedNodeRef.current &&
                  focusedClusterId === null
                ) {
                  hasInitialFitRef.current = true;
                  fg3dRef.current?.zoomToFit(motionConfigRef.current.reducedMotion ? 0 : 400, 48);
                }
              }}
            />
          ) : (
            <ForceGraph2D
              ref={fg2dRef}
              width={graphSize.width}
              height={graphSize.height}
              graphData={filteredGraph}
              backgroundColor="#05070d"
              nodeRelSize={1}
              nodeVal={getNodeVal}
              nodeCanvasObject={paintNode2D}
              nodeLabel={renderNodeLabel3D}
              nodePointerAreaPaint={(node, color, ctx) => {
                const r = Math.max(
                  visualPropsByNodeIdRef.current.get(node.id)?.radius || node.val || 10,
                  6
                );
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI, false);
                ctx.fill();
              }}
              onNodeHover={handleNodeHover}
              onNodeClick={handleSelectAndFocusNode}
              onBackgroundClick={() => {
                setSelectedNode(null);
                selectedNodeRef.current = null;
                setFocusedClusterId(null);
              }}
              linkWidth={getLinkWidth}
              linkColor={getLinkColor}
              linkDirectionalParticles={getLinkParticles}
              linkDirectionalParticleWidth={2.5}
              cooldownTicks={100}
              onEngineStop={() => {
                if (
                  !hasInitialFitRef.current &&
                  !selectedNodeRef.current &&
                  focusedClusterId === null
                ) {
                  hasInitialFitRef.current = true;
                  fg2dRef.current?.zoomToFit(motionConfigRef.current.reducedMotion ? 0 : 300, 32);
                }
              }}
            />
          )}
        </main>

        {/* Painel Contextual de Inspeção do Grafo de Conhecimento 3D */}
        <div className="z-20 shrink-0 p-2 lg:h-full lg:p-3">
          <SpaceInspectorPanel
            metadata={graphData.metadata}
            stats={filteredGraph.stats}
            graphMode={graphMode}
            selectedNode={activeNode}
            neighborhood={neighborhood}
            hiddenClusters={hiddenClusters}
            focusedClusterId={focusedClusterId}
            onFocusCluster={handleFocusCluster}
            onToggleClusterVisibility={handleToggleClusterVisibility}
            onSelectNode={handleSelectAndFocusNode}
            onFocusNode={flyCameraToNode}
            onCloseSelection={() => {
              setSelectedNode(null);
              selectedNodeRef.current = null;
              setHoverNode(null);
              hoverNodeRef.current = null;
            }}
            recentPlanets={recentPlanets}
            visibleNodes={filteredGraph.nodes}
            showLegend={showLegend}
            onToggleLegend={() => setShowLegend((prev) => !prev)}
          />
        </div>
      </div>

      {loggingOut && (
        <div
          role="status"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-sm text-zinc-200 backdrop-blur-sm"
        >
          Encerrando sessão...
        </div>
      )}
    </div>
  );
}
