"use client";

import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import {
  Network,
  Compass,
  Radio,
  Sparkles,
  Share2,
  ExternalLink,
  X,
  Eye,
  EyeOff,
  Crosshair,
  Layers,
  History,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Activity,
  Music,
  Maximize2,
} from "lucide-react";
import {
  buildNodeProvenanceProfile,
  decomposeEdgeWeight,
  computePlanetVisualProps,
} from "../../lib/spaceGraphModel.js";
import ConnectionExplorer from "../ConnectionExplorer";

/**
 * Helper to display human-friendly data source labels.
 */
function formatSourceLabel(source) {
  switch (source) {
    case "verified_playback_history":
      return "Histórico de Reprodução Verificado";
    case "recent_playback_history":
      return "Histórico de Reprodução Recente";
    case "spotify_top_affinity":
      return "Afinidade Algorítmica Spotify";
    case "genre_tracks_dedup":
      return "Deduplicação de Faixas de Gênero";
    default:
      return source || "Não informado";
  }
}

/**
 * Helper to display human-friendly observation period labels.
 */
function formatPeriodLabel(period) {
  switch (period) {
    case "historico_observado":
      return "Histórico Observado (Reproduções Reais)";
    case "short_term":
      return "Últimas 4 semanas (Curto Prazo)";
    case "medium_term":
      return "Últimos 6 meses (Médio Prazo)";
    case "long_term":
      return "Vários Anos (Longo Prazo)";
    default:
      return period || "Não informado";
  }
}

/**
 * Computes proportional listening metrics for the Inspector panel with deterministic fallbacks.
 */
function deriveInspectorListeningMetrics(node, metadata, graphMode) {
  if (!node || typeof node !== "object") {
    return {
      listeningCount: 1,
      listeningRank: null,
      listeningRatio: 0.5,
      listeningRatioPct: "50.0%",
      diameter: "14.00",
      radius: "7.00",
      maxDiameter: graphMode === "bipartite" ? "24.00" : "28.00",
      listeningMetricType: "estimated_listening_index",
      listeningMetricLabel: "Índice Estimado de Escuta",
      listeningSource: "spotify_top_affinity",
      listeningPeriod: "medium_term",
      observedPlays: 0,
      savedTracksCount: 0,
      topTracksCount: 0,
      affinityRank: null,
      affinityScore: null,
    };
  }

  const isGenre = node.node_type === "genre";
  const baseProps = computePlanetVisualProps(node, metadata || {}, graphMode, []);

  const observedPlays = Number(
    node.observed_plays ??
    baseProps.observed_plays ??
    0
  );

  const listeningMetricType =
    node.listening_metric_type ||
    baseProps.listening_metric_type ||
    (observedPlays > 0 ? "observed_plays" : "estimated_listening_index");

  const listeningMetricLabel =
    node.listening_metric_label ||
    baseProps.listening_metric_label ||
    (listeningMetricType === "observed_plays"
      ? "Reproduções Observadas"
      : "Índice Estimado de Escuta");

  const listeningSource =
    node.listening_source ||
    baseProps.listening_source ||
    (listeningMetricType === "observed_plays"
      ? "verified_playback_history"
      : isGenre
      ? "genre_tracks_dedup"
      : "spotify_top_affinity");

  const listeningPeriod =
    node.listening_period ||
    baseProps.listening_period ||
    (listeningMetricType === "observed_plays" ? "historico_observado" : "medium_term");

  const rawCount =
    node.listening_count ??
    node.play_count ??
    baseProps.listening_count ??
    (isGenre
      ? node.connected_artists_count ?? baseProps.connectedArtistsCount ?? 1
      : observedPlays > 0
      ? observedPlays
      : Math.max(
          1,
          Math.round(
            (Number(node.affinity_score) || 0.5) * 100 +
              (Number(node.global_popularity) || 50) * 0.2
          )
        ));
  const listeningCount = Math.max(1, Math.round(Number(rawCount) || 1));

  const listeningRank =
    node.listening_rank ?? baseProps.listening_rank ?? node.affinity_rank ?? 1;

  const affinityRank =
    node.affinity_rank ?? baseProps.affinity_rank ?? node.listening_rank ?? null;

  const affinityScore =
    node.affinity_score ?? baseProps.affinity_score ?? null;

  const savedTracksCount = Number(
    node.saved_tracks_count ??
    baseProps.saved_tracks_count ??
    0
  );

  const topTracksCount = Number(
    node.top_tracks_count ??
    baseProps.top_tracks_count ??
    (Array.isArray(node.top_tracks) ? node.top_tracks.length : 0)
  );

  const D_max = isGenre ? 30.0 : graphMode === "bipartite" ? 24.0 : 28.0;
  const rawRatio =
    node.listening_ratio ??
    baseProps.listening_ratio ??
    Math.min(1.0, Math.max(0.05, (Number(baseProps.radius) || 7.0) / (D_max / 2)));
  const listeningRatio = Math.min(1.0, Math.max(0.01, Number(rawRatio) || 0.5));

  const rawDiameter =
    node.diameter ??
    baseProps.diameter ??
    Number((D_max * listeningRatio).toFixed(2));
  const diameterNum = Number(rawDiameter) || Number((D_max * listeningRatio).toFixed(2));
  const radiusNum = diameterNum / 2;

  return {
    listeningCount,
    listeningRank,
    listeningRatio,
    listeningRatioPct: `${(listeningRatio * 100).toFixed(1)}%`,
    diameter: diameterNum.toFixed(2),
    radius: radiusNum.toFixed(2),
    maxDiameter: D_max.toFixed(2),
    listeningMetricType,
    listeningMetricLabel,
    listeningSource,
    listeningPeriod,
    observedPlays,
    savedTracksCount,
    topTracksCount,
    affinityRank,
    affinityScore,
  };
}

/**
 * Formats cluster label replacing legacy spatial names with Graphify Cluster terminology.
 */
function formatClusterLabel(cluster, fallbackId = 0) {
  if (cluster?.dominant_genres?.[0]) {
    return `Cluster ${cluster.dominant_genres[0]}`;
  }
  if (typeof cluster?.label === "string" && cluster.label.trim()) {
    return cluster.label
      .replace(/^Constelação\s+/i, "Cluster ")
      .replace(/^Sistema\s+/i, "Cluster ");
  }
  return `Cluster #${fallbackId + 1}`;
}

/**
 * SpaceInspectorPanel — Graphify 3D Knowledge Graph Contextual Inspector
 *
 * - Topological Telemetry (Modularity Q, Bridge Artist, visible nodes & edges)
 * - Proportional Listening Sizing Metrics (L_i, #listening_rank, L_i/L_max %, D_i = D_max * (L_i / L_max))
 * - Louvain Clusters with focus & visibility toggles
 * - Accessible Node List & Recent History
 * - Graphify 3D Knowledge Graph Legend
 * - Detailed Node Inspector with strict [DADO SPOTIFY] vs [INFERÊNCIA BEATCODE] separation,
 *   4-attribute edge breakdown (0.65g + 0.25c + 0.10t + shared_genres), and 1-hop / 2-hop harmonic navigation.
 */
export function SpaceInspectorPanel({
  metadata = null,
  stats = null,
  graphMode = "artists",
  selectedNode = null,
  neighborhood = null,
  hiddenClusters = [],
  focusedClusterId = null,
  onFocusCluster,
  onToggleClusterVisibility,
  onSelectNode,
  onFocusNode,
  onCloseSelection,
  recentPlanets = [],
  visibleNodes = [],
  showLegend = true,
  onToggleLegend,
  connectionsRef = null,
  selectedLinkKey = null,
  selectedExplanation = null,
  nodeConnections = [],
  nodesById = new Map(),
  onSelectLink = null,
}) {
  const scrollBodyRef = useRef(null);
  const [collapsedSections, setCollapsedSections] = useState({
    telemetry: false,
    constellations: false,
    catalog: false,
    history: false,
    directConnections: false,
    indirectConnections: false,
  });

  useEffect(() => {
    if (selectedNode?.id && scrollBodyRef.current) {
      scrollBodyRef.current.scrollTop = 0;
    }
  }, [selectedNode?.id]);

  const toggleSection = useCallback((sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  }, []);

  const isClusterHidden = useCallback(
    (clusterId) => {
      if (!hiddenClusters) return false;
      if (hiddenClusters instanceof Set) return hiddenClusters.has(clusterId);
      if (Array.isArray(hiddenClusters)) return hiddenClusters.includes(clusterId);
      return false;
    },
    [hiddenClusters]
  );

  const provenanceProfile = useMemo(() => {
    if (!selectedNode) return null;
    return buildNodeProvenanceProfile(selectedNode, graphMode);
  }, [selectedNode, graphMode]);

  const listeningMetrics = useMemo(
    () => deriveInspectorListeningMetrics(selectedNode, metadata, graphMode),
    [selectedNode, metadata, graphMode]
  );

  const directConnections = neighborhood?.directConnections || [];
  const indirectConnections = neighborhood?.indirectConnections || [];

  const modularityScore = useMemo(() => {
    const raw = metadata?.modularity_score;
    if (Number.isFinite(raw)) {
      return Number(raw).toFixed(3);
    }
    return "0.000";
  }, [metadata?.modularity_score]);

  const bridgeArtist = metadata?.bridge_artist || null;
  const clusters = Array.isArray(metadata?.clusters) ? metadata.clusters : [];

  const visibleNodesCount = stats?.visibleNodes ?? metadata?.total_nodes ?? 0;
  const visibleLinksCount = stats?.visibleLinks ?? metadata?.total_edges ?? metadata?.total_links ?? 0;

  return (
    <aside
      className="space-hud-glass w-full lg:w-[410px] max-w-full flex flex-col h-full overflow-hidden text-zinc-100 rounded-2xl border border-zinc-800/80 shadow-2xl transition-all duration-300"
      data-testid="space-inspector-panel"
      role="region"
      aria-label="Painel de Inspeção do Grafo 3D"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/70 bg-zinc-950/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-wider uppercase text-zinc-200">
              Inspetor Graphify 3D
            </h2>
            <p className="text-[10px] text-zinc-400">
              {graphMode === "bipartite"
                ? "Grafo Bipartido · Artistas ↔ Gêneros"
                : "Grafo de Conhecimento 3D · Proporção de Escutas"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleLegend && (
            <button
              type="button"
              onClick={onToggleLegend}
              className={`space-camera-dock-btn text-[11px] gap-1 px-2 py-1 h-7 ${
                showLegend
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : ""
              }`}
              title={showLegend ? "Recolher Legenda do Grafo" : "Abrir Legenda do Grafo"}
              aria-label="Alternar Legenda do Grafo"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Legenda</span>
            </button>
          )}

          {selectedNode && onCloseSelection && (
            <button
              type="button"
              onClick={onCloseSelection}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
              title="Fechar detalhes do nó"
              aria-label="Fechar detalhes do nó"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div
        ref={scrollBodyRef}
        className="flex-1 overflow-y-auto divide-y divide-zinc-800/60"
      >
        {/* 1. Selected Node Details (When active) */}
        {selectedNode && provenanceProfile ? (
          <section
            className="p-4 space-y-5 bg-zinc-950/40"
            data-testid="planet-inspector-details"
            aria-label="Dossiê do Nó Selecionado"
          >
            {/* Header: Node Identity & Focus Actions */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {provenanceProfile.raw.spotify.image_url ? (
                    <img
                      src={provenanceProfile.raw.spotify.image_url}
                      alt={provenanceProfile.raw.spotify.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400/40 shadow-lg shadow-emerald-950/50"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base border-2 shadow-lg"
                      style={{
                        backgroundColor: `${selectedNode.color || "#1DB954"}22`,
                        borderColor: selectedNode.color || "#1DB954",
                        color: selectedNode.color || "#1DB954",
                      }}
                    >
                      {selectedNode.node_type === "genre" ? (
                        <Radio className="w-6 h-6" />
                      ) : (
                        (provenanceProfile.raw.spotify.name || "A")[0]?.toUpperCase()
                      )}
                    </div>
                  )}

                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                      {provenanceProfile.raw.spotify.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-medium text-zinc-400">
                        {selectedNode.node_type === "genre" ? (
                          <span className="text-sky-400">Hub Semântico · Gênero</span>
                        ) : (
                          <span className="text-emerald-400">Nó do Grafo · Artista</span>
                        )}
                      </span>
                      {selectedNode.cluster_id !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                          Cluster #{selectedNode.cluster_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onFocusNode && (
                    <button
                      type="button"
                      onClick={() => onFocusNode(selectedNode)}
                      className="space-camera-dock-btn px-2 py-1 text-[11px] gap-1 h-7 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20"
                      title="Centralizar câmera neste nó"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Foco no Nó</span>
                    </button>
                  )}
                  {onCloseSelection && (
                    <button
                      type="button"
                      onClick={onCloseSelection}
                      className="space-camera-dock-btn p-1 h-7 w-7 text-zinc-400 hover:text-white"
                      title="Fechar"
                      aria-label="Fechar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 1. DIMENSÃO 1: Métrica de Dimensão 3D (L_i) */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={
                    listeningMetrics.listeningMetricType === "observed_plays"
                      ? "space-badge-spotify text-[10px]"
                      : "space-badge-inferred text-[10px]"
                  }
                >
                  <Activity className="w-3 h-3" />
                  {listeningMetrics.listeningMetricType === "observed_plays"
                    ? "[DADO SPOTIFY / HISTÓRICO]"
                    : "[INFERÊNCIA BEATCODE / ÍNDICE DE ESCUTA]"}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  D_i = D_max × (L_i / L_max)
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                  <span>Métrica de Dimensão 3D (L_i):</span>
                  <span className="text-emerald-400 font-semibold">{listeningMetrics.listeningMetricLabel}</span>
                </h4>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  O diâmetro 3D é proporcional estritamente a L_i em relação ao nó com maior incidência do grafo.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    {listeningMetrics.listeningMetricLabel} (L_i)
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {listeningMetrics.listeningCount}{" "}
                    <span className="text-[10px] font-normal text-zinc-400">
                      {selectedNode.node_type === "genre"
                        ? "artistas/faixas"
                        : listeningMetrics.listeningMetricType === "observed_plays"
                        ? "reproduções"
                        : "pts (índice)"}
                    </span>
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Proporção (L_i / L_max)
                  </span>
                  <span className="font-mono font-bold text-sky-400 text-sm">
                    {listeningMetrics.listeningRatioPct}
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Dimensão 3D (D_i)
                  </span>
                  <span className="font-mono font-bold text-emerald-300 text-sm">
                    {listeningMetrics.diameter}{" "}
                    <span className="text-[10px] font-normal text-zinc-400">
                      (R={listeningMetrics.radius})
                    </span>
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Ranking Proporcional
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {listeningMetrics.listeningRank
                      ? `#${listeningMetrics.listeningRank}`
                      : "Sem ranking"}
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Fonte dos Dados
                  </span>
                  <span
                    className="text-zinc-200 text-[11px] font-medium truncate block mt-0.5"
                    title={listeningMetrics.listeningSource}
                  >
                    {formatSourceLabel(listeningMetrics.listeningSource)}
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Período Observado
                  </span>
                  <span
                    className="text-zinc-200 text-[11px] font-medium truncate block mt-0.5"
                    title={listeningMetrics.listeningPeriod}
                  >
                    {formatPeriodLabel(listeningMetrics.listeningPeriod)}
                  </span>
                </div>
              </div>

              {listeningMetrics.listeningMetricType === "estimated_listening_index" && (
                <div className="p-2 rounded-lg bg-sky-950/30 border border-sky-500/30 text-[11px] text-sky-200/90 leading-relaxed">
                  <strong className="text-sky-300">Nota metodológica:</strong> Trata-se de um índice estimado (baseado em afinidade e faixas principais), pois o Spotify não fornece contagens absolutas para aquele período.
                </div>
              )}
            </div>

            {/* 2. DIMENSÃO 2: Afinidade Spotify (Top Tracks / Top Artists) */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="space-badge-spotify text-[10px]">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  [DADO SPOTIFY / AFINIDADE]
                </span>
                {provenanceProfile.raw.spotify.spotify_url && (
                  <a
                    href={provenanceProfile.raw.spotify.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium hover:underline transition-colors"
                  >
                    <span>Spotify</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-zinc-100">
                  Afinidade Spotify (Top Artists / Top Tracks)
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Indicador de afinidade algorítmica do Spotify (não representa contagem de reproduções).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Posição no Top Ouvidos
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {listeningMetrics.affinityRank
                      ? `#${listeningMetrics.affinityRank}`
                      : "Sem ranking"}
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Score de Afinidade
                  </span>
                  <span className="font-mono font-bold text-sky-400 text-sm">
                    {listeningMetrics.affinityScore !== null && listeningMetrics.affinityScore !== undefined
                      ? `${(listeningMetrics.affinityScore * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Faixas em Destaque
                  </span>
                  <span className="font-mono font-bold text-zinc-200 text-sm">
                    {listeningMetrics.topTracksCount} faixas
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Popularidade Global
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-semibold text-zinc-200 text-sm">
                      {provenanceProfile.raw.spotify.global_popularity}/100
                    </span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${provenanceProfile.raw.spotify.global_popularity}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Genres Cataloged */}
              {Array.isArray(provenanceProfile.raw.spotify.genres) &&
                provenanceProfile.raw.spotify.genres.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                      Gêneros Associados
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {provenanceProfile.raw.spotify.genres.map((genre, idx) => (
                        <span
                          key={`${genre}-${idx}`}
                          className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-zinc-800/90 text-zinc-300 border border-zinc-700/60"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Top Tracks in Profile */}
              {Array.isArray(provenanceProfile.raw.spotify.top_tracks) &&
                provenanceProfile.raw.spotify.top_tracks.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1">
                      <Music className="w-3 h-3 text-emerald-400" />
                      Faixas Principais no Perfil
                    </span>
                    <ul className="space-y-1">
                      {provenanceProfile.raw.spotify.top_tracks
                        .slice(0, 4)
                        .map((track, idx) => {
                          const trackName =
                            typeof track === "string"
                              ? track
                              : track?.name || "Faixa";
                          const albumImg =
                            typeof track === "object"
                              ? track?.album_image || track?.album?.images?.[0]?.url
                              : null;
                          return (
                            <li
                              key={idx}
                              className="flex items-center gap-2 text-[11px] p-1.5 rounded-md bg-zinc-950/50 border border-zinc-800/60 text-zinc-300"
                            >
                              {albumImg ? (
                                <img
                                  src={albumImg}
                                  alt={trackName}
                                  className="w-5 h-5 rounded object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-[9px] text-zinc-400 shrink-0">
                                  {idx + 1}
                                </div>
                              )}
                              <span className="truncate">{trackName}</span>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}
            </div>

            {/* 3. DIMENSÃO 3: Biblioteca Salva (Saved Tracks) */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-purple-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="space-badge-spotify text-[10px]">
                  <BookOpen className="w-3 h-3 text-purple-400" />
                  [DADO SPOTIFY / BIBLIOTECA]
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-zinc-100">
                  Biblioteca Salva (Saved Tracks)
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Músicas salvas no seu acervo pessoal (não incrementam a quantidade de escutas).
                </p>
              </div>

              <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                  Músicas Salvas na Biblioteca
                </span>
                <span className="font-mono font-bold text-purple-400 text-sm">
                  {listeningMetrics.savedTracksCount}{" "}
                  <span className="text-[10px] font-normal text-zinc-400">
                    faixas salvas
                  </span>
                </span>
              </div>
            </div>

            {/* 4. BeatCode Topological Inferences */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-sky-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="space-badge-inferred text-[10px]">
                  <Activity className="w-3 h-3 text-sky-400" />
                  [INFERÊNCIA BEATCODE]
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Métricas Topológicas
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Centralidade Grau (CD)
                  </span>
                  <span className="font-semibold text-zinc-200 text-sm">
                    {provenanceProfile.raw.inferences.degree_centrality}
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Intermediação (CB)
                  </span>
                  <span className="font-semibold text-zinc-200 text-sm">
                    {provenanceProfile.raw.inferences.betweenness_centrality}
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Score Afinidade
                  </span>
                  <span className="font-semibold text-sky-400 text-sm">
                    {provenanceProfile.raw.inferences.affinity_score !== null
                      ? `${(provenanceProfile.raw.inferences.affinity_score * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>

                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Cluster Louvain
                  </span>
                  <span className="font-semibold text-sky-300 text-sm">
                    Cluster #{provenanceProfile.raw.inferences.cluster_id}
                  </span>
                </div>
              </div>

              {/* Genre-Specific Connected Artists Count */}
              {selectedNode.node_type === "genre" && (
                <div className="p-2 rounded-lg bg-sky-950/30 border border-sky-500/30 text-xs text-sky-200 flex items-center justify-between">
                  <span className="text-[11px]">Artistas conectados a este gênero:</span>
                  <span className="font-bold text-sm">
                    {provenanceProfile.raw.inferences.connected_artists_count ??
                      directConnections.length ??
                      1}
                  </span>
                </div>
              )}
            </div>

            {/* SECTION C: 1-Hop Direct Connections & 4-Attribute Decomposition */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => toggleSection("directConnections")}
                className="w-full flex items-center justify-between text-left py-1 text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Conexões Diretas 1-Hop ({directConnections.length})</span>
                </div>
                {collapsedSections.directConnections ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>

              {!collapsedSections.directConnections && (
                <div className="space-y-2">
                  {directConnections.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic p-3 bg-zinc-900/30 rounded-xl border border-zinc-800/60">
                      Nenhum nó vizinho direto visível com o limiar de arestas atual.
                    </p>
                  ) : (
                    directConnections.map((conn, idx) => {
                      const decomp =
                        conn.decomposition ||
                        (conn.link ? decomposeEdgeWeight(conn.link, graphMode) : null);
                      const neighborNode = conn.node || { id: conn.nodeId, name: conn.nodeId };
                      const neighborName = neighborNode?.name || conn.nodeId;
                      const comps = decomp?.components;

                      let genreBadgeLabel = "Sem sobreposição";
                      let genreBadgeColor = "bg-zinc-800 text-zinc-400 border-zinc-700";

                      if (decomp?.genreMatchType === "exact_and_subtoken_match") {
                        genreBadgeLabel = "Match Exato + Sub-token";
                        genreBadgeColor =
                          "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
                      } else if (decomp?.genreMatchType === "subtoken_lexical_match") {
                        genreBadgeLabel = "Match Léxico Sub-token";
                        genreBadgeColor =
                          "bg-sky-500/15 text-sky-300 border-sky-500/40";
                      } else if (decomp?.genreMatchType === "artist_genre_membership") {
                        genreBadgeLabel = "Afiliação de Gênero";
                        genreBadgeColor =
                          "bg-amber-500/15 text-amber-300 border-amber-500/40";
                      }

                      return (
                        <div
                          key={`${conn.nodeId}-${idx}`}
                          className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onSelectNode && onSelectNode(neighborNode || conn.nodeId)
                              }
                              className="text-left font-semibold text-xs text-zinc-100 hover:text-emerald-400 truncate transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-emerald-500"
                              title={`Selecionar ${neighborName}`}
                            >
                              {neighborName}
                            </button>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                {Number((conn.weight || 0) * 100).toFixed(1)}%
                              </span>
                              {onFocusNode && neighborNode && (
                                <button
                                  type="button"
                                  onClick={() => onFocusNode(neighborNode)}
                                  className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                                  title={`Centralizar câmera em ${neighborName}`}
                                  aria-label={`Centralizar câmera em ${neighborName}`}
                                >
                                  <Maximize2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 4-Attribute Decomposition Bars */}
                          {comps && (
                            <div className="space-y-1.5 pt-1 text-[10px]">
                              {/* 1. Genre Similarity (0.65g) */}
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-zinc-400">
                                  <span>Gênero (0.65g)</span>
                                  <span className="font-mono text-emerald-400">
                                    C_g = {comps.C_g?.toFixed(4)} (
                                    {Math.round(comps.genre_similarity * 100)}%)
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{
                                      width: `${Math.round(comps.genre_similarity * 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              {/* 2. Collaboration (0.25c) */}
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-zinc-400">
                                  <span>Colaboração (0.25c)</span>
                                  <span className="font-mono text-sky-400">
                                    C_c = {comps.C_c?.toFixed(4)} (
                                    {Math.round(comps.direct_collaboration * 100)}%)
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-sky-500 rounded-full"
                                    style={{
                                      width: `${Math.round(
                                        comps.direct_collaboration * 100
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              {/* 3. Co-listening (0.10t) */}
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-zinc-400">
                                  <span>Audição (0.10t)</span>
                                  <span className="font-mono text-amber-400">
                                    C_t = {comps.C_t?.toFixed(4)} (
                                    {Math.round(comps.co_listening * 100)}%)
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full"
                                    style={{
                                      width: `${Math.round(comps.co_listening * 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 4. Qualitative shared_genres attribute */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span
                              className={`px-2 py-0.5 text-[9px] font-semibold rounded border uppercase tracking-wider ${genreBadgeColor}`}
                            >
                              {genreBadgeLabel}
                            </span>
                            {Array.isArray(decomp?.sharedGenres) &&
                              decomp.sharedGenres.length > 0 &&
                              decomp.sharedGenres.slice(0, 3).map((sg, i) => (
                                <span
                                  key={i}
                                  className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-300 font-mono"
                                >
                                  {sg}
                                </span>
                              ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* SECTION D: 2-Hop Indirect Connections (Harmonic Ranking) */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => toggleSection("indirectConnections")}
                className="w-full flex items-center justify-between text-left py-1 text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  <span>Pontes Harmônicas 2-Hop ({indirectConnections.length})</span>
                </div>
                {collapsedSections.indirectConnections ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>

              {!collapsedSections.indirectConnections && (
                <div className="space-y-2">
                  {indirectConnections.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic p-3 bg-zinc-900/30 rounded-xl border border-zinc-800/60">
                      Nenhuma conexão indireta de 2 saltos detectada na sub-rede atual.
                    </p>
                  ) : (
                    indirectConnections.map((item, idx) => {
                      const destNode = item.node || { id: item.nodeId, name: item.nodeId };
                      const destName = destNode?.name || item.nodeId;
                      const scorePct = Number((item.relevanceScore || 0) * 100).toFixed(1);

                      return (
                        <div
                          key={`${item.nodeId}-${idx}`}
                          className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/70 hover:border-sky-500/40 transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onSelectNode && onSelectNode(destNode || item.nodeId)
                              }
                              className="text-left font-semibold text-xs text-zinc-200 hover:text-sky-400 truncate transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-sky-500"
                              title={`Navegar para ${destName}`}
                            >
                              {destName}
                            </button>
                            <span className="text-[10px] font-mono font-bold text-sky-300 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/30">
                              A₂ₕₒₚ: {scorePct}%
                            </span>
                          </div>

                          {/* Bridges via which this node is reachable */}
                          {Array.isArray(item.viaBridges) && item.viaBridges.length > 0 && (
                            <div className="text-[10px] text-zinc-400 space-y-1">
                              <span className="block text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
                                Alcançável via {item.viaBridges.length} ponte(s):
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {item.viaBridges.slice(0, 3).map((b, bIdx) => {
                                  const bridgeName = b.bridgeNode?.name || b.bridgeId;
                                  return (
                                    <button
                                      key={`${b.bridgeId}-${bIdx}`}
                                      type="button"
                                      onClick={() =>
                                        onSelectNode &&
                                        onSelectNode(b.bridgeNode || b.bridgeId)
                                      }
                                      className="px-2 py-0.5 rounded bg-zinc-800/90 text-zinc-300 hover:text-emerald-300 hover:bg-zinc-700/80 transition-colors border border-zinc-700/60 font-medium"
                                      title={`Selecionar ponte ${bridgeName}`}
                                    >
                                      {bridgeName}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </section>
        ) : (
          /* Empty selection prompt */
          <div className="p-4 text-center space-y-2 bg-zinc-950/20">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Network className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-zinc-200 tracking-wide uppercase">
              Selecione um Nó (Artista ou Gênero)
            </h3>
            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Clique em qualquer nó no Grafo 3D ou utilize os clusters e a lista abaixo para
              inspecionar escutas proporcionais, dados do Spotify e arestas de 4 atributos.
            </p>
          </div>
        )}

        {/* 2. Global Topological Telemetry */}
        <section className="p-4 space-y-3" aria-label="Telemetria Topológica do Grafo">
          <button
            type="button"
            onClick={() => toggleSection("telemetry")}
            className="w-full flex items-center justify-between text-left text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Telemetria da Rede Completa</span>
            </div>
            {collapsedSections.telemetry ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>

          {!collapsedSections.telemetry && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Modularity Q Card */}
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                      Modularidade Q
                    </span>
                    <span className="space-badge-inferred text-[9px] px-1.5 py-0.2">
                      [INFERÊNCIA BEATCODE]
                    </span>
                  </div>
                  <span className="block font-mono text-base font-bold text-sky-400">
                    {modularityScore}
                  </span>
                  <span className="block text-[9px] text-zinc-500">
                    Particionamento Louvain
                  </span>
                </div>

                {/* Visible Edges Card */}
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                    Arestas Visíveis
                  </span>
                  <span className="block font-mono text-base font-bold text-emerald-400">
                    {visibleLinksCount}
                  </span>
                  <span className="block text-[9px] text-zinc-500">
                    {visibleNodesCount} nós ativos
                  </span>
                </div>
              </div>

              {/* Bridge Artist Card */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Radio className="w-3 h-3 text-amber-400" />
                    Nó Ponte (Maior Intermediação Inter-Cluster)
                  </span>
                  <span className="space-badge-inferred text-[9px] px-1.5 py-0.2">
                    [INFERÊNCIA BEATCODE]
                  </span>
                </div>

                {bridgeArtist ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectNode) onSelectNode(bridgeArtist);
                      if (onFocusNode) onFocusNode(bridgeArtist);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-zinc-950/80 border border-amber-500/30 hover:border-amber-400/60 text-left transition-all group"
                  >
                    <div>
                      <span className="block font-semibold text-xs text-amber-300 group-hover:text-amber-200">
                        {bridgeArtist.name}
                      </span>
                      <span className="block text-[10px] text-zinc-400">
                        Clique para focar neste nó ponte do grafo
                      </span>
                    </div>
                    <Crosshair className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                  </button>
                ) : (
                  <p className="text-[11px] text-zinc-500 italic">
                    Nenhum nó ponte destacado na topologia atual.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 3. Louvain Clusters List */}
        <section className="p-4 space-y-3" aria-label="Clusters da Rede">
          <button
            type="button"
            onClick={() => toggleSection("constellations")}
            className="w-full flex items-center justify-between text-left text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Clusters Louvain ({clusters.length})</span>
            </div>
            {collapsedSections.constellations ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>

          {!collapsedSections.constellations && (
            <div className="space-y-2 pt-1">
              {clusters.length === 0 ? (
                <p className="text-xs text-zinc-500 italic p-3 bg-zinc-900/30 rounded-xl border border-zinc-800/60">
                  Nenhum cluster detectado.
                </p>
              ) : (
                clusters.map((cluster) => {
                  const clusterId = cluster.cluster_id;
                  const isHidden = isClusterHidden(clusterId);
                  const isFocused = focusedClusterId === clusterId;
                  const clusterColor = cluster.color || "#10B981";
                  const label = formatClusterLabel(cluster, clusterId);

                  return (
                    <div
                      key={clusterId}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                        isFocused
                          ? "bg-zinc-800/80 border-emerald-500/60 shadow-md shadow-emerald-950/40"
                          : isHidden
                          ? "bg-zinc-950/30 border-zinc-900 opacity-50"
                          : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onFocusCluster && onFocusCluster(cluster)}
                        className="flex items-center gap-2.5 text-left flex-1 truncate mr-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-emerald-500"
                        title={`Focar câmera no ${label}`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: clusterColor }}
                        />
                        <div className="truncate">
                          <span
                            className={`block text-xs font-semibold truncate ${
                              isHidden ? "line-through text-zinc-500" : "text-zinc-200"
                            }`}
                          >
                            {label}
                          </span>
                          <span className="block text-[10px] text-zinc-400 font-mono">
                            {cluster.artist_count || 0} nós
                          </span>
                        </div>
                      </button>

                      {onToggleClusterVisibility && (
                        <button
                          type="button"
                          onClick={() => onToggleClusterVisibility(clusterId)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isHidden
                              ? "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-700"
                          }`}
                          title={isHidden ? "Exibir cluster" : "Ocultar cluster"}
                          aria-label={
                            isHidden ? `Exibir ${label}` : `Ocultar ${label}`
                          }
                        >
                          {isHidden ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        {/* 4. Accessible Textual Node Catalog (WCAG 2.2 AA Alternative to 3D Canvas) */}
        {Array.isArray(visibleNodes) && visibleNodes.length > 0 && (
          <section
            className="p-4 space-y-3"
            aria-label="Catálogo Textual Acessível de Nós"
            data-testid="accessible-planet-list"
          >
            <button
              type="button"
              onClick={() => toggleSection("catalog")}
              aria-expanded={!collapsedSections.catalog}
              className="w-full flex items-center justify-between text-left text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-emerald-400" />
                <span>Catálogo de Nós ({visibleNodes.length} nós)</span>
              </div>
              {collapsedSections.catalog ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            {!collapsedSections.catalog && (
              <div
                role="list"
                aria-label="Lista de nós de artistas e gêneros visíveis"
                className="max-h-56 overflow-y-auto space-y-1.5 pr-1 pt-1"
              >
                <p className="my-2 text-xs text-zinc-400" role="status" aria-live="polite">
                  {visibleNodes.length} {visibleNodes.length === 1 ? "resultado" : "resultados"} de {visibleNodes.length} nós
                </p>
                {visibleNodes.map((nodeItem) => {
                  const isCurrent = selectedNode?.id === nodeItem.id;
                  const isGenre = nodeItem.node_type === "genre";
                  const rank = nodeItem.listening_rank ?? nodeItem.affinity_rank;
                  return (
                    <div key={nodeItem.id} role="listitem">
                      <button
                        type="button"
                        data-testid={`planet-list-item-${nodeItem.id}`}
                        aria-pressed={isCurrent}
                        onClick={() => onSelectNode && onSelectNode(nodeItem)}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs border transition-all ${
                          isCurrent
                            ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/60"
                            : "bg-zinc-900/70 text-zinc-200 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/80"
                        }`}
                        title={nodeItem.name}
                      >
                        <span className="flex items-center gap-2 min-w-0 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: nodeItem.color || "#1DB954" }}
                            aria-hidden="true"
                          />
                          <span className="sr-only">{isGenre ? "Gênero: " : "Artista: "}</span>
                          <span className="font-semibold truncate">{nodeItem.name}</span>
                        </span>
                        <span className="shrink-0 text-[10px] font-mono text-zinc-400">
                          {isGenre
                            ? `Gênero · ${nodeItem.connected_artists_count ?? 1}`
                            : rank
                            ? `#${rank}`
                            : "Artista"}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 4b. Explorar Conexões (Accessible Connection Explorer) */}
        {nodesById && (
          <section className="p-4 space-y-3" aria-labelledby="connections-heading">
            <ConnectionExplorer
              sectionRef={connectionsRef}
              focusedNode={selectedNode}
              connections={nodeConnections}
              selectedKey={selectedLinkKey}
              explanation={selectedExplanation}
              nodesById={nodesById}
              onSelect={onSelectLink}
            />
          </section>
        )}

        {/* 5. Recent Exploration History */}
        {recentPlanets && recentPlanets.length > 0 && (
          <section className="p-4 space-y-3" aria-label="Histórico de Nós Visitados">
            <button
              type="button"
              onClick={() => toggleSection("history")}
              className="w-full flex items-center justify-between text-left text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>Nós Visitados Recentemente ({recentPlanets.length})</span>
              </div>
              {collapsedSections.history ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            {!collapsedSections.history && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {recentPlanets.map((planet) => {
                  const isCurrent = selectedNode?.id === planet.id;
                  return (
                    <button
                      key={planet.id}
                      type="button"
                      onClick={() => onSelectNode && onSelectNode(planet)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        isCurrent
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-900/40"
                          : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                      }`}
                      title={`Revisitar ${planet.name}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: planet.color || "#1DB954" }}
                      />
                      <span className="truncate max-w-[120px]">{planet.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 6. Graphify 3D Knowledge Graph Legend */}
        {showLegend && (
          <section
            className="p-4 space-y-3 bg-zinc-950/40"
            aria-label="Legenda do Grafo de Conhecimento 3D"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-zinc-300">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Legenda do Grafo 3D (Graphify)</span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              {/* Nós de Artistas */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-300 shrink-0 shadow-sm" />
                  <span className="font-semibold text-zinc-200">
                    Nós de Artistas (Esferas 3D)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Dimensão proporcional às escutas: D_i = D_max × (L_i / L_max), onde o
                  artista mais ouvido define 100% da escala (D_max) e os demais são
                  escalados pela razão exata L_i / L_max.
                </p>
              </div>

              {/* Hubs de Gêneros */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rotate-45 bg-sky-400 border border-sky-200 shrink-0 shadow-sm" />
                  <span className="font-semibold text-zinc-200">
                    Hubs Semânticos (Gêneros · Poliedros 3D)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Geometria poliédrica facetada com raio proporcional à incidência de
                  escuta/artistas conectados: R_g = D_g / 2 = R_max,genre × (L_g / L_max,genre).
                </p>
              </div>

              {/* Clusters Louvain */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  </div>
                  <span className="font-semibold text-zinc-200">
                    Clusters & Nó Ponte
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Cores identificam comunidades detectadas por modularidade Louvain (Q). O Nó
                  Ponte destaca o artista com maior centralidade de intermediação (C_B) entre
                  clusters.
                </p>
              </div>

              {/* Arestas Ponderadas */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400 rounded-full shrink-0" />
                  <span className="font-semibold text-zinc-200">
                    Arestas Ponderadas (4 Atributos)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Espessura e opacidade regidas pela fórmula W = 0.65g + 0.25c + 0.10t,
                  combinada com a classificação qualitativa de gêneros compartilhados
                  (shared_genres).
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

export default SpaceInspectorPanel;
