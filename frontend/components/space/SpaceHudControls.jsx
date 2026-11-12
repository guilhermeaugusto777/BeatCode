"use client";

import React from "react";
import {
  Search,
  Network,
  Map as MapIcon,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Compass,
  RotateCw,
  EyeOff,
  BookOpen,
  X,
  AlertTriangle,
} from "lucide-react";
import { deriveExplorationDepth } from "../../lib/spaceGraphModel";

const GRAPH_MODE_OPTIONS = [
  { key: "artists", label: "Artistas ↔ Artistas" },
  { key: "bipartite", label: "Artistas ↔ Gêneros (Bipartido)" },
];

const TIME_RANGE_OPTIONS = [
  { key: "short_term", label: "4 semanas" },
  { key: "medium_term", label: "6 meses" },
  { key: "long_term", label: "Histórico" },
];

const NODE_TYPE_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "artist", label: "Artistas" },
  { key: "genre", label: "Gêneros" },
];

const VIEW_MODE_OPTIONS = [
  { key: "space_3d", label: "Grafo 3D", Icon: Network },
  { key: "map_2d", label: "Mapa 2D", Icon: MapIcon },
];

function resolveDepthBadge(explorationDepth, selectedNode) {
  const fallback = deriveExplorationDepth({ selectedNode });
  const rawCode =
    typeof explorationDepth === "object" && explorationDepth !== null
      ? explorationDepth.code || fallback.code
      : String(explorationDepth || fallback.code).trim();

  if (
    rawCode === "planet_orbit" ||
    rawCode === "node_focus" ||
    rawCode === "Órbita Planetária" ||
    rawCode === "Foco no Nó" ||
    Boolean(selectedNode)
  ) {
    return { code: "planet_orbit", label: "Foco no Nó" };
  }
  if (
    rawCode === "star_system" ||
    rawCode === "cluster" ||
    rawCode === "Sistema Estelar" ||
    rawCode === "Cluster"
  ) {
    return { code: "star_system", label: "Cluster" };
  }
  return { code: "universe", label: "Rede Completa" };
}

export function SpaceHudControls({
  viewMode = "space_3d",
  onViewModeChange,
  graphMode = "artists",
  onGraphModeChange,
  timeRange = "medium_term",
  onTimeRangeChange,
  minEdgeWeight = 0.15,
  onMinEdgeWeightChange,
  searchQuery = "",
  onSearchQueryChange,
  searchInputRef,
  searchMatches = [],
  onSelectSearchNode,
  nodeTypeFilter = "all",
  onNodeTypeFilterChange,
  explorationDepth,
  selectedNode = null,
  onCenterSelected,
  onResetOverview,
  onZoomIn,
  onZoomOut,
  visualEffects = { starfield: false, orbital_rings: false, reduced_motion: false },
  onToggleVisualEffect,
  autoRotate = false,
  onToggleAutoRotate,
  showLegend = false,
  onToggleLegend,
  statusBanner = null,
  onDismissBanner,
  isDemo = false,
  onExitDemo,
  onLogout,
}) {
  const depthInfo = resolveDepthBadge(explorationDepth, selectedNode);
  const safeMinWeight = Number.isFinite(minEdgeWeight)
    ? Math.min(0.65, Math.max(0.05, minEdgeWeight))
    : 0.15;
  const trimmedSearch = typeof searchQuery === "string" ? searchQuery.trim() : "";
  const matchesList = Array.isArray(searchMatches) ? searchMatches.slice(0, 8) : [];
  const isReducedMotion = Boolean(visualEffects?.reduced_motion);

  const handleLeave = () => {
    if (isDemo) {
      if (onExitDemo) onExitDemo();
      else if (onLogout) onLogout();
    } else {
      if (onLogout) onLogout();
      else if (onExitDemo) onExitDemo();
    }
  };

  return (
    <>
      {/* Barra Superior Compacta — Graphify 3D Knowledge Graph HUD */}
      <header
        className="space-hud-glass relative z-30 flex shrink-0 flex-wrap items-center gap-2.5 border-b border-zinc-800/80 px-3 py-2.5 sm:px-5"
        aria-label="Controles do Grafo de Conhecimento 3D BeatCode"
      >
        {/* Identidade + Badge de Escala de Inspeção */}
        <div className="flex items-center gap-2 pr-1">
          <span
            className={`h-2.5 w-2.5 rounded-full bg-[#1DB954] shadow-[0_0_12px_#1DB954] ${
              isReducedMotion ? "" : "animate-pulse"
            }`}
            aria-hidden="true"
          />
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-100">
            BeatCode <span className="text-[#1DB954]">Graphify 3D</span>
          </span>
          <span className="hidden text-[11px] text-zinc-400 xl:inline">
            / {isDemo ? "demonstração" : "rede de escutas"}
          </span>
          <span
            data-testid="exploration-depth-badge"
            aria-live="polite"
            className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-950/50 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-sky-300"
            title="Escala ativa de navegação no grafo"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true" />
            {depthInfo.label}
          </span>
        </div>

        {/* Alternador de Modo do Grafo (Unipartido vs Bipartido) */}
        <div
          className="flex rounded-lg border border-zinc-800 bg-zinc-950/90 p-0.5"
          role="group"
          aria-label="Modo de topologia do grafo"
        >
          {GRAPH_MODE_OPTIONS.map((gm) => {
            const active = graphMode === gm.key;
            return (
              <button
                key={gm.key}
                type="button"
                onClick={() => onGraphModeChange?.(gm.key)}
                aria-pressed={active}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border border-[#1DB954]/50 bg-emerald-500/20 font-semibold text-[#4ade80]"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {gm.label}
              </button>
            );
          })}
        </div>

        {/* Seletor de Horizonte Temporal */}
        <div
          className="flex rounded-lg border border-zinc-800 bg-zinc-950/90 p-0.5"
          role="group"
          aria-label="Horizonte temporal do Spotify"
        >
          {TIME_RANGE_OPTIONS.map((tr) => {
            const active = timeRange === tr.key;
            return (
              <button
                key={tr.key}
                type="button"
                onClick={() => onTimeRangeChange?.(tr.key)}
                aria-pressed={active}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#1DB954] font-semibold text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {tr.label}
              </button>
            );
          })}
        </div>

        {/* Slider de Limiar de Aresta */}
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/70 px-2.5 py-1">
          <label htmlFor="edge-threshold" className="text-xs text-zinc-300 whitespace-nowrap">
            Arestas:{" "}
            <strong className="font-mono text-zinc-100 tabular-nums">
              {safeMinWeight.toFixed(2)}
            </strong>
          </label>
          <input
            id="edge-threshold"
            type="range"
            min="0.05"
            max="0.65"
            step="0.02"
            value={safeMinWeight}
            onChange={(e) => onMinEdgeWeightChange?.(parseFloat(e.target.value))}
            aria-label="Limiar mínimo de peso das arestas"
            className="w-20 cursor-pointer accent-[#1DB954] sm:w-24"
          />
        </div>

        {/* Busca de Nós com Atalho "/" e Dropdown Rápido */}
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-400"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder="Buscar nó: artista ou gênero (/)"
            aria-label="Buscar nó: artista ou gênero"
            className="h-8 w-44 rounded-lg border border-zinc-800 bg-zinc-950/90 pl-8 pr-7 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#1DB954] sm:w-52"
          />
          {trimmedSearch.length > 0 ? (
            <button
              type="button"
              onClick={() => onSearchQueryChange?.("")}
              aria-label="Limpar busca"
              className="absolute right-1.5 rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <kbd
              className="pointer-events-none absolute right-2 hidden rounded border border-zinc-700 bg-zinc-900 px-1 text-[10px] font-mono text-zinc-400 sm:inline-block"
              aria-hidden="true"
            >
              /
            </kbd>
          )}

          {trimmedSearch.length > 0 && (
            <div
              role="listbox"
              aria-label="Resultados rápidos da busca no grafo"
              className="space-hud-glass absolute left-0 top-9 z-40 max-h-64 w-64 overflow-y-auto rounded-xl p-1.5 shadow-2xl"
            >
              {matchesList.length > 0 ? (
                matchesList.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    role="option"
                    aria-selected={selectedNode?.id === node.id}
                    onClick={() => onSelectSearchNode?.(node)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800/90"
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: node.color || "#1DB954" }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-medium">{node.name}</span>
                    </span>
                    <span className="shrink-0 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                      {node.node_type === "genre" ? "Gênero" : "Artista"}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-2.5 py-2 text-xs text-zinc-400">
                  Nenhum nó de artista ou gênero encontrado.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filtro por Tipo de Nó (Todos / Artistas / Gêneros) */}
        <div
          className="flex rounded-lg border border-zinc-800 bg-zinc-950/90 p-0.5"
          role="group"
          aria-label="Filtrar por tipo de nó"
        >
          {NODE_TYPE_OPTIONS.map((nt) => {
            const active = nodeTypeFilter === nt.key;
            return (
              <button
                key={nt.key}
                type="button"
                onClick={() => onNodeTypeFilterChange?.(nt.key)}
                aria-pressed={active}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-zinc-800 font-semibold text-white"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {nt.label}
              </button>
            );
          })}
        </div>

        {/* Alternador Grafo 3D vs Mapa 2D + Ação de Sessão */}
        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex rounded-lg border border-zinc-800 bg-zinc-950/90 p-0.5"
            role="group"
            aria-label="Alternar visualização Grafo 3D ou Mapa 2D"
          >
            {VIEW_MODE_OPTIONS.map(({ key, label, Icon }) => {
              const active = viewMode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onViewModeChange?.(key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "border border-sky-400/50 bg-sky-500/20 text-sky-300"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleLeave}
            className="rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            {isDemo ? "Voltar" : "Sair"}
          </button>
        </div>
      </header>

      {/* Banner de Status Não-Bloqueante (Fallback WebGL / Avisos de Contexto) */}
      {statusBanner && statusBanner.message && (
        <div
          role="status"
          aria-live="polite"
          data-testid="space-status-banner"
          className="space-hud-glass z-30 flex items-center justify-between gap-3 border-b border-amber-500/35 bg-amber-950/40 px-4 py-2 text-xs text-amber-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <span>{statusBanner.message}</span>
          </div>
          {onDismissBanner && (
            <button
              type="button"
              onClick={onDismissBanner}
              aria-label="Fechar aviso de status"
              className="rounded border border-amber-400/40 px-2 py-0.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-900/50"
            >
              Fechar
            </button>
          )}
        </div>
      )}

      {/* Doca Flutuante de Controles de Câmera 3D e Visualização */}
      <nav
        aria-label="Controles de câmera do Grafo 3D"
        data-testid="space-camera-dock"
        className="space-hud-glass pointer-events-auto fixed bottom-4 left-4 z-30 flex flex-wrap items-center gap-1.5 rounded-2xl p-1.5"
      >
        <button
          type="button"
          onClick={() => onZoomIn?.()}
          aria-label="Zoom +"
          title="Aproximar câmera (Zoom +)"
          className="space-camera-dock-btn gap-1"
        >
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Zoom +</span>
        </button>

        <button
          type="button"
          onClick={() => onZoomOut?.()}
          aria-label="Zoom −"
          title="Afastar câmera (Zoom −)"
          className="space-camera-dock-btn gap-1"
        >
          <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Zoom −</span>
        </button>

        <button
          type="button"
          onClick={() => onCenterSelected?.()}
          disabled={!selectedNode}
          aria-label="Foco no Nó"
          title={
            selectedNode
              ? `Centralizar câmera no nó ${selectedNode.name}`
              : "Selecione um nó para centralizar"
          }
          className="space-camera-dock-btn gap-1"
        >
          <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Foco no Nó</span>
        </button>

        <button
          type="button"
          onClick={() => onResetOverview?.()}
          aria-label="Rede Completa"
          title="Restaurar enquadramento da Rede Completa"
          className="space-camera-dock-btn gap-1"
        >
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Rede Completa</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleAutoRotate?.()}
          aria-pressed={Boolean(autoRotate)}
          disabled={isReducedMotion}
          aria-label="Rotação 360°"
          title={
            isReducedMotion
              ? "Rotação 360° desativada no modo Movimento Reduzido"
              : "Alternar rotação 360° automática do grafo"
          }
          className={`space-camera-dock-btn gap-1 ${
            autoRotate && !isReducedMotion
              ? "border-emerald-500/60 bg-emerald-950/60 text-emerald-300"
              : ""
          }`}
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Rotação 360°</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleVisualEffect?.("reduced_motion")}
          aria-pressed={isReducedMotion}
          aria-label="Movimento Reduzido"
          title="Desativar animações de transição de câmera, rotação e partículas"
          className={`space-camera-dock-btn gap-1 ${
            isReducedMotion
              ? "border-amber-400/60 bg-amber-950/60 text-amber-300"
              : ""
          }`}
        >
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Movimento Reduzido</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleLegend?.()}
          aria-pressed={Boolean(showLegend)}
          aria-label="Legenda do Grafo"
          title="Abrir ou fechar a Legenda do Grafo 3D"
          className={`space-camera-dock-btn gap-1 ${
            showLegend
              ? "border-emerald-500/60 bg-emerald-950/60 text-emerald-300"
              : ""
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Legenda do Grafo</span>
        </button>
      </nav>
    </>
  );
}

export default SpaceHudControls;
