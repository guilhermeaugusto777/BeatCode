"use client";

import React, { useMemo, useCallback, useState } from "react";
import {
  Globe,
  Compass,
  Radio,
  Sparkles,
  Orbit,
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
  Maximize2
} from "lucide-react";
import { buildNodeProvenanceProfile, decomposeEdgeWeight } from "../../lib/spaceGraphModel.js";

/**
 * SpaceInspectorPanel
 *
 * Contextual Inspector Sidebar for BeatCode Space:
 * - Topological Telemetry (Modularity Q, Bridge Artist, planet/trajectory stats)
 * - Stellar Systems / Constellations (Louvain clusters with focus & visibility controls)
 * - Recent Exploration History (revisitable planet chips)
 * - Cosmic Legend (explaining celestial radii, atmospheres, rings, and trajectories)
 * - Detailed Planet / Core Inspector (with strict [DADO SPOTIFY] vs [INFERÊNCIA BEATCODE] separation,
 *   4-attribute edge breakdown 0.65g + 0.25c + 0.10t + shared_genres, and 1-hop / 2-hop harmonic navigation).
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
}) {
  const [collapsedSections, setCollapsedSections] = useState({
    telemetry: false,
    constellations: false,
    catalog: false,
    history: false,
    directConnections: false,
    indirectConnections: false
  });

  const toggleSection = useCallback((sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  }, []);

  const isClusterHidden = useCallback((clusterId) => {
    if (!hiddenClusters) return false;
    if (hiddenClusters instanceof Set) return hiddenClusters.has(clusterId);
    if (Array.isArray(hiddenClusters)) return hiddenClusters.includes(clusterId);
    return false;
  }, [hiddenClusters]);

  const provenanceProfile = useMemo(() => {
    if (!selectedNode) return null;
    return buildNodeProvenanceProfile(selectedNode, graphMode);
  }, [selectedNode, graphMode]);

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

  const visiblePlanetsCount = stats?.visibleNodes ?? metadata?.total_nodes ?? 0;
  const visibleLinksCount = stats?.visibleLinks ?? metadata?.total_edges ?? 0;

  return (
    <aside
      className="space-hud-glass w-full lg:w-[410px] max-w-full flex flex-col h-full overflow-hidden text-zinc-100 rounded-2xl border border-zinc-800/80 shadow-2xl transition-all duration-300"
      data-testid="space-inspector-panel"
      role="region"
      aria-label="Painel de Inspeção Espacial"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/70 bg-zinc-950/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-wider uppercase text-zinc-200">
              Observatório BeatCode
            </h2>
            <p className="text-[10px] text-zinc-400">
              {graphMode === "bipartite"
                ? "Grafo Bipartido · Artistas ↔ Gêneros"
                : "Topologia Cósmica · Afinidade Gravitacional"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleLegend && (
            <button
              type="button"
              onClick={onToggleLegend}
              className={`space-camera-dock-btn text-[11px] gap-1 px-2 py-1 h-7 ${
                showLegend ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : ""
              }`}
              title={showLegend ? "Recolher Legenda Cósmica" : "Abrir Legenda Cósmica"}
              aria-label="Alternar Legenda Cósmica"
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
              title="Fechar detalhes do astro"
              aria-label="Fechar detalhes do astro"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">

        {/* 1. Selected Planet/Core Details (When active) */}
        {selectedNode && provenanceProfile ? (
          <section
            className="p-4 space-y-5 bg-zinc-950/40"
            data-testid="planet-inspector-details"
            aria-label="Dossiê do Astro Selecionado"
          >
            {/* Header: Node Identity & Orbit Centering Actions */}
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
                        color: selectedNode.color || "#1DB954"
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
                          <span className="text-sky-400">Núcleo Estelar · Gênero</span>
                        ) : (
                          <span className="text-emerald-400">Planeta · Artista</span>
                        )}
                      </span>
                      {selectedNode.cluster_id !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                          Constelação #{selectedNode.cluster_id}
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
                      title="Centralizar câmera na órbita deste astro"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Focar Órbita</span>
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

            {/* SECTION A: Measured Spotify Source Data */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="space-badge-spotify text-[10px]">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  [DADO SPOTIFY]
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

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider">
                    Posição no Perfil
                  </span>
                  <span className="font-semibold text-emerald-400 text-sm">
                    {provenanceProfile.raw.spotify.affinity_rank
                      ? `#${provenanceProfile.raw.spotify.affinity_rank}`
                      : "Sem ranking"}
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
                        style={{ width: `${provenanceProfile.raw.spotify.global_popularity}%` }}
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
                      Gêneros Catalogados
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
                      {provenanceProfile.raw.spotify.top_tracks.slice(0, 4).map((track, idx) => {
                        const trackName = typeof track === "string" ? track : track?.name || "Faixa";
                        const albumImg = typeof track === "object" ? track?.album_image || track?.album?.images?.[0]?.url : null;
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

            {/* SECTION B: BeatCode Topological Inferences */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-sky-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="space-badge-inferred text-[10px]">
                  <Activity className="w-3 h-3 text-sky-400" />
                  [INFERÊNCIA BEATCODE]
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Topologia Louvain + k-NN
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
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
                    Constelação
                  </span>
                  <span className="font-semibold text-sky-300 text-sm">
                    Sistema #{provenanceProfile.raw.inferences.cluster_id}
                  </span>
                </div>
              </div>

              {/* Genre-Specific Connected Artists Count */}
              {selectedNode.node_type === "genre" && (
                <div className="p-2 rounded-lg bg-sky-950/30 border border-sky-500/30 text-xs text-sky-200 flex items-center justify-between">
                  <span className="text-[11px]">Artistas conectados a este hub:</span>
                  <span className="font-bold text-sm">
                    {provenanceProfile.raw.inferences.connected_artists_count ?? 1}
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
                  <Orbit className="w-3.5 h-3.5 text-emerald-400" />
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
                      Nenhum vizinho direto visível com o filtro de arestas atual.
                    </p>
                  ) : (
                    directConnections.map((conn, idx) => {
                      const decomp =
                        conn.decomposition || (conn.link ? decomposeEdgeWeight(conn.link, graphMode) : null);
                      const neighborNode = conn.node;
                      const neighborName = neighborNode?.name || conn.nodeId;
                      const comps = decomp?.components;

                      let genreBadgeLabel = "Sem sobreposição";
                      let genreBadgeColor = "bg-zinc-800 text-zinc-400 border-zinc-700";

                      if (decomp?.genreMatchType === "exact_and_subtoken_match") {
                        genreBadgeLabel = "Match Exato + Sub-token";
                        genreBadgeColor = "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
                      } else if (decomp?.genreMatchType === "subtoken_lexical_match") {
                        genreBadgeLabel = "Match Léxico Sub-token";
                        genreBadgeColor = "bg-sky-500/15 text-sky-300 border-sky-500/40";
                      } else if (decomp?.genreMatchType === "artist_genre_membership") {
                        genreBadgeLabel = "Afiliação de Gênero";
                        genreBadgeColor = "bg-amber-500/15 text-amber-300 border-amber-500/40";
                      }

                      return (
                        <div
                          key={`${conn.nodeId}-${idx}`}
                          className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => neighborNode && onSelectNode && onSelectNode(neighborNode)}
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
                                    C_g = {comps.C_g?.toFixed(4)} ({Math.round(comps.genre_similarity * 100)}%)
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${Math.round(comps.genre_similarity * 100)}%` }}
                                  />
                                </div>
                              </div>

                              {/* 2. Collaboration (0.25c) */}
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-zinc-400">
                                  <span>Colaboração (0.25c)</span>
                                  <span className="font-mono text-sky-400">
                                    C_c = {comps.C_c?.toFixed(4)} ({Math.round(comps.direct_collaboration * 100)}%)
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-sky-500 rounded-full"
                                    style={{ width: `${Math.round(comps.direct_collaboration * 100)}%` }}
                                  />
                                </div>
                              </div>

                              {/* 3. Co-listening (0.10t) */}
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-zinc-400">
                                  <span>Audição (0.10t)</span>
                                  <span className="font-mono text-amber-400">
                                    C_t = {comps.C_t?.toFixed(4)} ({Math.round(comps.co_listening * 100)}%)
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full"
                                    style={{ width: `${Math.round(comps.co_listening * 100)}%` }}
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
                      const destNode = item.node;
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
                              onClick={() => destNode && onSelectNode && onSelectNode(destNode)}
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
                                      onClick={() => b.bridgeNode && onSelectNode && onSelectNode(b.bridgeNode)}
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
              <Globe className="w-5 h-5 animate-pulse" />
            </div>
            <h3 className="text-xs font-bold text-zinc-200 tracking-wide uppercase">
              Selecione um Planeta ou Estrela
            </h3>
            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Clique em qualquer astro no espaço cósmico ou utilize o histórico e as constelações abaixo
              para inspecionar dados do Spotify, inferências e a física gravitacional de 4 atributos.
            </p>
          </div>
        )}

        {/* 2. Global Topological Telemetry */}
        <section className="p-4 space-y-3" aria-label="Telemetria Topológica da Galáxia">
          <button
            type="button"
            onClick={() => toggleSection("telemetry")}
            className="w-full flex items-center justify-between text-left text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Telemetria da Galáxia</span>
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

                {/* Visible Trajectories Card */}
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                  <span className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                    Trajetórias Visíveis
                  </span>
                  <span className="block font-mono text-base font-bold text-emerald-400">
                    {visibleLinksCount}
                  </span>
                  <span className="block text-[9px] text-zinc-500">
                    {visiblePlanetsCount} astros em cena
                  </span>
                </div>
              </div>

              {/* Bridge Artist Card */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Radio className="w-3 h-3 text-amber-400" />
                    Artista Ponte (Maior Inter-Cluster)
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
                        Clique para viajar até esta ponte cósmica
                      </span>
                    </div>
                    <Crosshair className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                  </button>
                ) : (
                  <p className="text-[11px] text-zinc-500 italic">
                    Nenhum artista ponte destacado na topologia atual.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 3. Stellar Systems / Constellations List */}
        <section className="p-4 space-y-3" aria-label="Sistemas Estelares e Constelações">
          <button
            type="button"
            onClick={() => toggleSection("constellations")}
            className="w-full flex items-center justify-between text-left text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Sistemas Estelares / Constelações ({clusters.length})</span>
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
                  Nenhum sistema estelar detectado.
                </p>
              ) : (
                clusters.map((cluster) => {
                  const clusterId = cluster.cluster_id;
                  const isHidden = isClusterHidden(clusterId);
                  const isFocused = focusedClusterId === clusterId;
                  const clusterColor = cluster.color || "#10B981";
                  const label =
                    cluster.label ||
                    (cluster.dominant_genres?.[0]
                      ? `Constelação ${cluster.dominant_genres[0]}`
                      : `Sistema ${clusterId + 1}`);

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
                        title={`Focar câmera no sistema estelar ${label}`}
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
                            {cluster.artist_count || 0} astros
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
                          title={isHidden ? "Exibir constelação" : "Ocultar constelação"}
                          aria-label={
                            isHidden
                              ? `Exibir constelação ${label}`
                              : `Ocultar constelação ${label}`
                          }
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        {/* 4. Accessible Textual Planet/Star Catalog (WCAG 2.2 AA Alternative to 3D Canvas) */}
        {Array.isArray(visibleNodes) && visibleNodes.length > 0 && (
          <section
            className="p-4 space-y-3"
            aria-label="Catálogo Textual Acessível de Astros"
            data-testid="accessible-planet-list"
          >
            <button
              type="button"
              onClick={() => toggleSection("catalog")}
              aria-expanded={!collapsedSections.catalog}
              className="w-full flex items-center justify-between text-left text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exploração por Lista ({visibleNodes.length} astros)</span>
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
                aria-label="Lista de planetas e núcleos estelares visíveis"
                className="max-h-48 overflow-y-auto space-y-1.5 pr-1 pt-1"
              >
                {visibleNodes.slice(0, 30).map((nodeItem) => {
                  const isCurrent = selectedNode?.id === nodeItem.id;
                  const isGenre = nodeItem.node_type === "genre";
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
                      >
                        <span className="flex items-center gap-2 min-w-0 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: nodeItem.color || "#1DB954" }}
                            aria-hidden="true"
                          />
                          <span className="font-semibold truncate">{nodeItem.name}</span>
                        </span>
                        <span className="shrink-0 text-[10px] font-mono text-zinc-400">
                          {isGenre
                            ? `Gênero · ${nodeItem.connected_artists_count ?? 1}`
                            : nodeItem.affinity_rank
                            ? `#${nodeItem.affinity_rank}`
                            : "Planeta"}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 5. Recent Exploration History */}
        {recentPlanets && recentPlanets.length > 0 && (
          <section className="p-4 space-y-3" aria-label="Histórico de Exploração Recente">
            <button
              type="button"
              onClick={() => toggleSection("history")}
              className="w-full flex items-center justify-between text-left text-xs font-bold tracking-wider uppercase text-zinc-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>Astros Visitados Recentemente ({recentPlanets.length})</span>
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

        {/* 5. Cosmic Legend (Visual Encodings) */}
        {showLegend && (
          <section className="p-4 space-y-3 bg-zinc-950/40" aria-label="Legenda Cósmica">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-zinc-300">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Legenda Cósmica BeatCode</span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              {/* Planetas */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-300 shrink-0 shadow-sm" />
                  <span className="font-semibold text-zinc-200">
                    Planetas (Artistas)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Raio R_planet proporcional à massa composta M = 0.55S_aff + 0.30P_glob + 0.15C_D.
                  Texturas fotográficas do perfil Spotify ou procedurais cósmicas.
                </p>
              </div>

              {/* Núcleos Estelares */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rotate-45 bg-sky-400 border border-sky-200 shrink-0 shadow-sm" />
                  <span className="font-semibold text-zinc-200">
                    Núcleos Estelares (Gêneros Bipartidos)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Geometria octaédrica emissiva com raio R_star = 5.0 + 10.0 · min(1.0, k_g / 12.0),
                  derivado da contagem de artistas associados ao hub musical.
                </p>
              </div>

              {/* Halo & Anéis Orbitais */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  </div>
                  <span className="font-semibold text-zinc-200">
                    Halo Atmosférico e Anéis Orbitais
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Corona atmosférica indexada pela radiação cultural Φ = 0.70√C_B + 0.30C_D.
                  Anel orbital destacado concedido ao Artista Ponte ou com diversidade inter-cluster ≥ 30%.
                </p>
              </div>

              {/* Trajetórias Luminosas */}
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400 rounded-full shrink-0" />
                  <span className="font-semibold text-zinc-200">
                    Trajetórias Luminosas (Arestas de Afinidade)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Espessura e brilho regidos pela fórmula W = 0.65g + 0.25c + 0.10t, combinada com
                  a classificação qualitativa de sobreposição lexical (shared_genres).
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
