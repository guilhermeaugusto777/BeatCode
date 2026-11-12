"use client";

/* global window, document */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import * as d3 from "d3-force";
import {
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

export default function SpotifyConstellationGraph() {
  const fg3dRef = useRef(null);
  const fg2dRef = useRef(null);
  const graphContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const imageCache = useRef({});
  const resourceRegistryRef = useRef(createResourceRegistry());
  const starfieldObjectRef = useRef(null);
  const sceneRef = useRef(null);

  const [graphData, setGraphData] = useState({ metadata: null, nodes: [], links: [] });
  const [experience, setExperience] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [graphSize, setGraphSize] = useState({ width: 960, height: 640 });

  // Space preferences & HUD state
  const [viewMode, setViewMode] = useState("space_3d");
  const [preferredViewMode, setPreferredViewMode] = useState("space_3d");
  const [graphMode, setGraphMode] = useState("artists");
  const [timeRange, setTimeRange] = useState("medium_term");
  const [minEdgeWeight, setMinEdgeWeight] = useState(0.15);
  const [nodeTypeFilter, setNodeTypeFilter] = useState("all");
  const [hiddenClusters, setHiddenClusters] = useState([]);
  const [visualEffects, setVisualEffects] = useState({
    starfield: true,
    orbital_rings: true,
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
    setGraphMode(loaded.graph_mode);
    setTimeRange(loaded.time_range);
    setMinEdgeWeight(loaded.min_edge_weight);
    setNodeTypeFilter(loaded.node_type_filter);
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
    setGraphData({ metadata: null, nodes: [], links: [] });
    setSelectedNode(null);
    setHoverNode(null);
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

  // 6. Compute motion configuration, filtered graph, centroids, neighborhood, and depth
  const motionConfig = useMemo(
    () =>
      computeMotionConfig({
        prefersReducedMotion,
        userReducedMotion: Boolean(visualEffects?.reduced_motion),
      }),
    [prefersReducedMotion, visualEffects?.reduced_motion]
  );

  const filteredGraph = useMemo(
    () =>
      filterSpaceGraph(graphData, {
        minEdgeWeight,
        searchQuery,
        nodeTypeFilter,
        hiddenClusters,
        filterNodesBySearch: false,
      }),
    [graphData, minEdgeWeight, searchQuery, nodeTypeFilter, hiddenClusters]
  );

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

  const visualPropsByNodeId = useMemo(() => {
    const map = new Map();
    for (const node of filteredGraph.nodes) {
      map.set(
        node.id,
        computePlanetVisualProps(node, graphData.metadata, graphMode, filteredGraph.links)
      );
    }
    return map;
  }, [filteredGraph.nodes, filteredGraph.links, graphData.metadata, graphMode]);

  const activeNode = hoverNode || selectedNode;

  const neighborhood = useMemo(() => {
    if (!activeNode?.id) {
      return {
        nodeId: null,
        targetNode: null,
        directConnections: [],
        indirectConnections: [],
        highlightNodeIds: new Set(),
        highlightLinkKeys: new Set(),
      };
    }
    return computeNodeNeighborhood(activeNode.id, filteredGraph, graphMode);
  }, [activeNode, filteredGraph, graphMode]);

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

  // 8. Configure 3D forces & starfield when 3D graph is active
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
        if (visualEffects?.starfield !== false) {
          const stars = createCosmicStarfield(1200, 1400, resourceRegistryRef.current);
          starfieldObjectRef.current = stars;
          if (typeof scene.add === "function") {
            scene.add(stars);
          }
        }
      }
    }
  }, [
    viewMode,
    webglHealthy,
    graphMode,
    clusterCentroids,
    filteredGraph.nodes,
    visualEffects?.starfield,
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
      d3.forceCollide((node) => (node.val || 12) + 8)
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

  const handleSelectAndFocusNode = useCallback(
    (nodeOrRef) => {
      if (!nodeOrRef) return;
      const resolved =
        graphData.nodes.find((n) => n.id === nodeOrRef.id) || nodeOrRef;
      setSelectedNode(resolved);
      setFocusedClusterId(null);
      const updatedPrefs = recordVisitedPlanet(resolved);
      setRecentPlanets(updatedPrefs.recent_planets || []);
      flyCameraToNode(resolved);
    },
    [graphData.nodes, flyCameraToNode]
  );

  const handleFocusCluster = useCallback(
    (cluster) => {
      if (!cluster) return;
      const clusterId = cluster.cluster_id;
      setSelectedNode(null);
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
    setSelectedNode(null);
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
    } else if (fg2dRef.current) {
      fg2dRef.current.zoomToFit(ms, 36);
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

  const handleViewModeChange = useCallback(
    (nextMode) => {
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
    },
    []
  );

  // 14. 3D Node renderer & sanitized tooltip
  const renderNodeThreeObject = useCallback(
    (node) => {
      const visualProps =
        visualPropsByNodeId.get(node.id) ||
        computePlanetVisualProps(node, graphData.metadata, graphMode, filteredGraph.links);
      return createPlanetObject3D(
        node,
        visualProps,
        {
          orbitalRings: visualEffects?.orbital_rings !== false,
          metadata: graphData.metadata,
          graphMode,
          links: filteredGraph.links,
        },
        resourceRegistryRef.current
      );
    },
    [
      visualPropsByNodeId,
      graphData.metadata,
      graphMode,
      filteredGraph.links,
      visualEffects?.orbital_rings,
    ]
  );

  const renderNodeLabel3D = useCallback((node) => {
    const safeName = escapeHtml(node?.name || "Desconhecido");
    const isGenre = node?.node_type === "genre";
    const typeLabel = isGenre ? "Núcleo Estelar · Gênero" : "Planeta · Artista";
    const metricText = isGenre
      ? `Artistas conectados: ${escapeHtml(node?.connected_artists_count ?? 1)}`
      : node?.affinity_rank
      ? `Rank #${escapeHtml(node.affinity_rank)} no perfil`
      : `Centralidade: ${escapeHtml(node?.metrics?.degree_centrality ?? 0)}`;
    return `<div style="padding:6px 10px;border-radius:10px;background:rgba(8,13,24,0.92);border:1px solid rgba(29,185,84,0.45);color:#f9fafb;font-family:system-ui,sans-serif;font-size:12px;line-height:1.35;">
      <strong style="display:block;color:#ffffff;">${safeName}</strong>
      <span style="color:#4ade80;font-size:11px;">${typeLabel}</span><br/>
      <span style="color:#a1a1aa;font-size:11px;">${metricText}</span>
    </div>`;
  }, []);

  // 15. 2D Canvas Node Painter
  const paintNode2D = useCallback(
    (node, ctx, globalScale) => {
      if (node.x === undefined || node.y === undefined) return;

      const isHighlighted =
        !activeNode || neighborhood.highlightNodeIds.has(node.id);
      const isFocused = activeNode && activeNode.id === node.id;
      const vProps = visualPropsByNodeId.get(node.id);
      const radius = vProps?.radius || node.val || 10;

      ctx.save();
      ctx.globalAlpha = isHighlighted ? 1.0 : 0.16;

      if (isFocused) {
        ctx.shadowColor = node.color || "#1DB954";
        ctx.shadowBlur = 22;
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
        // Optional Orbital Ring in 2D for bridge artists
        if (vProps?.hasOrbitalRing && visualEffects?.orbital_rings !== false) {
          ctx.beginPath();
          ctx.ellipse(
            node.x,
            node.y,
            radius * 1.65,
            radius * 0.65,
            vProps.ringTiltRad || -0.35,
            0,
            2 * Math.PI
          );
          ctx.strokeStyle = node.color || "#1DB954";
          ctx.lineWidth = 1.4 / globalScale;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.closePath();
        ctx.save();
        ctx.clip();

        const img = imageCache.current[node.id];
        if (img && img.complete && img.naturalWidth !== 0) {
          ctx.drawImage(img, node.x - radius, node.y - radius, radius * 2, radius * 2);
        } else {
          ctx.fillStyle = "#10141d";
          ctx.fill();
          const initials = String(node.name || "A")
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase();
          ctx.font = `700 ${Math.max(radius * 0.65, 4)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = node.color || "#1DB954";
          ctx.fillText(initials, node.x, node.y);
        }
        ctx.restore();

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.lineWidth = isFocused ? 3.5 / globalScale : 2.2 / globalScale;
        ctx.strokeStyle = node.color || "#1DB954";
        ctx.stroke();

        if (globalScale >= 1.05 || (activeNode && isHighlighted)) {
          const fontSize = Math.max(11 / globalScale, 3.5);
          ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#F9FAFB";
          ctx.fillText(node.name, node.x, node.y + radius + 4 / globalScale);
        }
      }

      ctx.restore();
    },
    [activeNode, neighborhood.highlightNodeIds, visualPropsByNodeId, visualEffects?.orbital_rings]
  );

  // 16. Link styling callbacks (shared between 3D and 2D)
  const isLinkHighlighted = useCallback(
    (link) => {
      if (!activeNode) return false;
      const sId = typeof link.source === "object" ? link.source?.id : link.source;
      const tId = typeof link.target === "object" ? link.target?.id : link.target;
      return neighborhood.highlightLinkKeys.has(`${sId}__${tId}`);
    },
    [activeNode, neighborhood.highlightLinkKeys]
  );

  const getLinkWidth = useCallback(
    (link) => {
      const w = Number.isFinite(link?.weight) ? link.weight : 0.2;
      return isLinkHighlighted(link) ? Math.max(1.8, w * 4.5) : Math.max(0.6, w * 1.8);
    },
    [isLinkHighlighted]
  );

  const getLinkColor = useCallback(
    (link) => {
      if (!activeNode) return "rgba(148, 163, 184, 0.24)";
      return isLinkHighlighted(link)
        ? "rgba(29, 185, 84, 0.92)"
        : "rgba(63, 63, 70, 0.08)";
    },
    [activeNode, isLinkHighlighted]
  );

  const getLinkParticles = useCallback(
    (link) => {
      if (motionConfig.reducedMotion || motionConfig.directionalParticles === 0) {
        return 0;
      }
      return isLinkHighlighted(link) ? 2 : 0;
    },
    [motionConfig.reducedMotion, motionConfig.directionalParticles, isLinkHighlighted]
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
    setGraphData({ metadata: null, nodes: [], links: [] });
    setSelectedNode(null);
    setHoverNode(null);
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
            BeatCode <span className="text-[#1DB954]">Space</span>{" "}
            <span className="font-normal text-zinc-500">/ universo musical 3D</span>
          </div>
          <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="relative z-10 max-w-xl">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
                Seu gosto tem gravidade e órbita
              </p>
              <h1 className="text-5xl font-black leading-[0.98] tracking-[-0.06em] sm:text-7xl">
                Ouça as conexões.
                <br />
                <span className="text-[#1DB954]">Explore o cosmos.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-zinc-400">
                Navegue por planetas de artistas, núcleos estelares de gêneros e constelações em um
                observatório 3D e 2D interativo da sua música.
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
                    Entre com sua conta para mapear seus planetas e constelações.
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
                    Experimente o universo 3D e 2D com dados verificados de exemplo.
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
              <span className="preview-caption">PLANETAS · NÚCLEOS ESTELARES · CONSTELAÇÕES</span>
            </div>
          </div>
          <p className="text-xs text-zinc-600">
            BeatCode Space diferencia explicitamente dados medidos pelo Spotify de inferências topológicas.
          </p>
        </div>
      </main>
    );
  }

  const render3DActive = viewMode === "space_3d" && webglHealthy;

  return (
    <div className="flex h-dvh w-full flex-col overflow-y-auto bg-[#03050a] font-sans text-zinc-100 lg:overflow-hidden">
      {/* Barra de Observação Superior, Busca, Banner e Doca de Câmera 360° */}
      <SpaceHudControls
        viewMode={render3DActive ? "space_3d" : "map_2d"}
        onViewModeChange={handleViewModeChange}
        graphMode={graphMode}
        onGraphModeChange={setGraphMode}
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
        onNodeTypeFilterChange={setNodeTypeFilter}
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
        {/* Palco Cósmico Principal (3D WebGL ou 2D Cartográfico) */}
        <main
          ref={graphContainerRef}
          data-testid="beatcode-space-stage"
          className="space-universe-stage relative min-h-[54vh] min-w-0 flex-1 overflow-hidden lg:min-h-0"
          aria-label="Universo musical interativo BeatCode Space"
        >
          {loading ? (
            <div
              className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-300"
              role="status"
            >
              Mapeando planetas, núcleos estelares e trajetórias gravitacionais...
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
              Nenhum artista encontrado neste período. Escolha outro intervalo para explorar.
            </div>
          ) : filteredGraph.nodes.length === 0 ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-zinc-300"
              role="status"
            >
              <p>Nenhum planeta ou gênero visível com os filtros atuais.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setNodeTypeFilter("all");
                  setHiddenClusters([]);
                }}
                className="rounded-xl border border-emerald-500/50 bg-emerald-950/40 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50"
              >
                Restaurar filtros visuais
              </button>
            </div>
          ) : render3DActive ? (
            <ForceGraph3D
              ref={fg3dRef}
              width={graphSize.width}
              height={graphSize.height}
              graphData={filteredGraph}
              backgroundColor="rgba(3, 5, 10, 0)"
              showNavInfo={false}
              nodeRelSize={1}
              nodeVal={(node) => visualPropsByNodeId.get(node.id)?.radius || node.val || 8}
              nodeThreeObject={renderNodeThreeObject}
              nodeThreeObjectExtend={false}
              nodeLabel={renderNodeLabel3D}
              onNodeHover={(node) => setHoverNode(node || null)}
              onNodeClick={handleSelectAndFocusNode}
              onBackgroundClick={() => {
                setSelectedNode(null);
                setFocusedClusterId(null);
              }}
              linkWidth={getLinkWidth}
              linkColor={getLinkColor}
              linkOpacity={0.55}
              linkDirectionalParticles={getLinkParticles}
              linkDirectionalParticleWidth={2.4}
              cooldownTicks={120}
              onEngineStop={() => {
                if (!selectedNode && focusedClusterId === null) {
                  fg3dRef.current?.zoomToFit(motionConfig.reducedMotion ? 0 : 400, 48);
                }
              }}
            />
          ) : (
            <ForceGraph2D
              ref={fg2dRef}
              width={graphSize.width}
              height={graphSize.height}
              graphData={filteredGraph}
              backgroundColor="#03050a"
              nodeRelSize={1}
              nodeVal={(node) => visualPropsByNodeId.get(node.id)?.radius || node.val || 10}
              nodeCanvasObject={paintNode2D}
              nodePointerAreaPaint={(node, color, ctx) => {
                const r = visualPropsByNodeId.get(node.id)?.radius || node.val || 12;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI, false);
                ctx.fill();
              }}
              onNodeHover={(node) => setHoverNode(node || null)}
              onNodeClick={handleSelectAndFocusNode}
              onBackgroundClick={() => {
                setSelectedNode(null);
                setFocusedClusterId(null);
              }}
              linkWidth={getLinkWidth}
              linkColor={getLinkColor}
              linkDirectionalParticles={getLinkParticles}
              linkDirectionalParticleWidth={3}
              cooldownTicks={120}
              onEngineStop={() => {
                if (!selectedNode && focusedClusterId === null) {
                  fg2dRef.current?.zoomToFit(motionConfig.reducedMotion ? 0 : 300, 32);
                }
              }}
            />
          )}
        </main>

        {/* Painel Contextual de Inspeção de Planetas, Proveniência e Legenda Cósmica */}
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
              setHoverNode(null);
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
