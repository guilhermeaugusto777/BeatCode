"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import * as d3 from "d3-force";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const TIME_RANGES = [
  { key: "short_term", label: "4 Semanas" },
  { key: "medium_term", label: "6 Meses" },
  { key: "long_term", label: "Histórico" },
];

const GRAPH_MODES = [
  { key: "artists", label: "Artistas ↔ Artistas" },
  { key: "bipartite", label: "Artistas ↔ Gêneros (Bipartido)" },
];

export default function SpotifyConstellationGraph() {
  const fgRef = useRef(null);
  const imageCache = useRef({});

  const [graphData, setGraphData] = useState({ metadata: null, nodes: [], links: [] });
  const [timeRange, setTimeRange] = useState("medium_term");
  const [graphMode, setGraphMode] = useState("artists");
  const [demoMode, setDemoMode] = useState(false);
  const [minEdgeWeight, setMinEdgeWeight] = useState(0.15);
  const [hoverNode, setHoverNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setAuthError(null);

    const url = `${API_BASE_URL}/api/graph?time_range=${timeRange}&graph_mode=${graphMode}&limit=50&demo=${demoMode}`;

    fetch(url, { credentials: "include" })
      .then(async (res) => {
        if (res.status === 401 || res.status === 400) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            errBody.detail || "Não autenticado no Spotify. Conecte sua conta ou ative o Modo Demo."
          );
        }
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        data.nodes.forEach((node) => {
          if (node.image_url && !imageCache.current[node.id]) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = node.image_url;
            imageCache.current[node.id] = img;
          }
        });
        setGraphData(data);
        setSelectedNode(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setAuthError(err.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [timeRange, graphMode, demoMode]);

  useEffect(() => {
    if (!fgRef.current) return;
    fgRef.current.d3Force("charge").strength(graphMode === "bipartite" ? -210 : -260);
    fgRef.current
      .d3Force("link")
      .distance((link) => (graphMode === "bipartite" ? 85 : 115 * (1.15 - (link.weight || 0.2))));
    fgRef.current.d3Force("collide", d3.forceCollide((node) => (node.val || 12) + 8));
  }, [graphData, graphMode]);

  const filteredGraph = useMemo(() => {
    const validLinks = graphData.links.filter((l) => l.weight >= minEdgeWeight);
    return {
      nodes: graphData.nodes,
      links: validLinks,
    };
  }, [graphData, minEdgeWeight]);

  const activeNode = hoverNode || selectedNode;

  const { highlightNodes, highlightLinks } = useMemo(() => {
    const hNodes = new Set();
    const hLinks = new Set();
    if (!activeNode) return { highlightNodes: hNodes, highlightLinks: hLinks };

    hNodes.add(activeNode.id);
    filteredGraph.links.forEach((link) => {
      const sId = typeof link.source === "object" ? link.source.id : link.source;
      const tId = typeof link.target === "object" ? link.target.id : link.target;
      if (sId === activeNode.id || tId === activeNode.id) {
        hNodes.add(sId);
        hNodes.add(tId);
        hLinks.add(link);
      }
    });
    return { highlightNodes: hNodes, highlightLinks: hLinks };
  }, [activeNode, filteredGraph]);

  const paintNode = useCallback(
    (node, ctx, globalScale) => {
      if (node.x === undefined || node.y === undefined) return;

      const isHighlighted = !activeNode || highlightNodes.has(node.id);
      const isFocused = activeNode && activeNode.id === node.id;
      const radius = node.val || 14;

      ctx.save();
      ctx.globalAlpha = isHighlighted ? 1.0 : 0.14;

      if (isFocused) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 22;
      }

      if (node.node_type === "genre") {
        // Desenha um hexágono estilizado para nós de Gênero no modo Bipartido
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const hx = node.x + radius * Math.cos(angle);
          const hy = node.y + radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fillStyle = "#18181B";
        ctx.fill();
        ctx.lineWidth = isFocused ? 3 / globalScale : 2 / globalScale;
        ctx.strokeStyle = node.color || "#1DB954";
        ctx.stroke();

        const fontSize = Math.max(9.5 / globalScale, 3.2);
        ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = node.color || "#1DB954";
        ctx.fillText(`# ${node.name}`, node.x, node.y);
      } else {
        // Desenha nó circular para Artistas
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.closePath();
        ctx.save();
        ctx.clip();

        const img = imageCache.current[node.id];
        if (img && img.complete && img.naturalWidth !== 0) {
          ctx.drawImage(img, node.x - radius, node.y - radius, radius * 2, radius * 2);
        } else {
          ctx.fillStyle = "#18181B";
          ctx.fill();
          const initials = node.name
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

        if (globalScale >= 1.1 || (activeNode && isHighlighted)) {
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
    [activeNode, highlightNodes]
  );

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#090A0F] text-zinc-100 font-sans">
      {/* Barra Superior de Controles */}
      <header className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/90 px-4 py-2.5 backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-2 pr-2">
          <span className="h-3 w-3 rounded-full bg-[#1DB954] animate-pulse" />
          <h1 className="text-xs font-bold tracking-wider uppercase text-zinc-200">
            Spotify Music Graph
          </h1>
        </div>

        {/* Alternador Unipartido vs Bipartido */}
        <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800">
          {GRAPH_MODES.map((gm) => (
            <button
              key={gm.key}
              onClick={() => setGraphMode(gm.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                graphMode === gm.key
                  ? "bg-emerald-500/20 text-[#1DB954] border border-[#1DB954]/50 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {gm.label}
            </button>
          ))}
        </div>

        {/* Seletor de Período */}
        <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.key}
              onClick={() => setTimeRange(tr.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                timeRange === tr.key
                  ? "bg-[#1DB954] text-black font-semibold shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>

        {/* Limiar de Peso da Aresta */}
        <div className="flex items-center gap-2 border-l border-zinc-800 pl-3">
          <label className="text-xs text-zinc-400">
            Limiar: <strong className="text-zinc-200">{minEdgeWeight.toFixed(2)}</strong>
          </label>
          <input
            type="range"
            min="0.05"
            max="0.65"
            step="0.02"
            value={minEdgeWeight}
            onChange={(e) => setMinEdgeWeight(parseFloat(e.target.value))}
            className="w-24 accent-[#1DB954] cursor-pointer"
          />
        </div>

        {/* Botão Modo Demo / Login Spotify */}
        <div className="flex items-center gap-2 border-l border-zinc-800 pl-3">
          <button
            onClick={() => setDemoMode((prev) => !prev)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
              demoMode
                ? "border-amber-500/60 bg-amber-500/20 text-amber-300"
                : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white"
            }`}
          >
            {demoMode ? "Modo Demo Ativo" : "Usar Dados Demo"}
          </button>
          <a
            href={`${API_BASE_URL}/auth/login`}
            className="px-3 py-1 text-xs font-semibold rounded-md bg-[#1DB954] text-black hover:bg-[#1ed760] transition-all"
          >
            Conectar Spotify
          </a>
        </div>
      </header>

      {/* Canvas Principal */}
      <main className="flex-1 h-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Calculando matriz TF-IDF, árvore geradora e comunidades Louvain...
          </div>
        ) : authError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-zinc-300 max-w-md">{authError}</p>
            <div className="flex gap-3">
              <a
                href={`${API_BASE_URL}/auth/login`}
                className="rounded-xl bg-[#1DB954] px-5 py-2.5 text-xs font-bold text-black hover:bg-[#1ed760]"
              >
                Autenticar com Spotify (OAuth 2.0)
              </a>
              <button
                onClick={() => setDemoMode(true)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
              >
                Explorar com Dataset Demo
              </button>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={filteredGraph}
            backgroundColor="#090A0F"
            nodeRelSize={1}
            nodeVal={(node) => node.val}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, (node.val || 14) + 2, 0, 2 * Math.PI, false);
              ctx.fill();
            }}
            onNodeHover={(node) => setHoverNode(node || null)}
            onNodeClick={(node) => {
              setSelectedNode((prev) => (prev?.id === node.id ? null : node));
              fgRef.current?.centerAt(node.x, node.y, 600);
              fgRef.current?.zoom(2.1, 600);
            }}
            onBackgroundClick={() => setSelectedNode(null)}
            linkWidth={(link) =>
              highlightLinks.has(link) ? link.weight * 4.5 : link.weight * 1.8
            }
            linkColor={(link) => {
              if (!activeNode) return "rgba(161, 161, 170, 0.22)";
              return highlightLinks.has(link)
                ? "rgba(29, 185, 84, 0.88)"
                : "rgba(63, 63, 70, 0.06)";
            }}
            linkDirectionalParticles={(link) => (highlightLinks.has(link) ? 2 : 0)}
            linkDirectionalParticleWidth={3}
            cooldownTicks={130}
          />
        )}
      </main>

      {/* Painel Lateral Analítico */}
      <aside className="w-96 border-l border-zinc-800/80 bg-zinc-900/90 p-6 backdrop-blur-xl overflow-y-auto z-20 flex flex-col gap-6">
        {graphData.metadata && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Topologia do Seu Gosto
              </h2>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">
                {graphMode === "bipartite" ? "Bipartido" : "Unipartido"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-zinc-950/90 p-3 border border-zinc-800/80">
                <span className="text-xs text-zinc-400">Modularidade (Q)</span>
                <p className="text-xl font-bold text-[#1DB954]">
                  {graphData.metadata.modularity_score}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-950/90 p-3 border border-zinc-800/80">
                <span className="text-xs text-zinc-400">Arestas Visíveis</span>
                <p className="text-xl font-bold text-zinc-100">
                  {filteredGraph.links.length}
                </p>
              </div>
            </div>

            {graphData.metadata.bridge_artist && (
              <div className="rounded-xl bg-gradient-to-r from-emerald-950/60 to-zinc-950 p-4 border border-emerald-800/40 mb-4">
                <span className="text-[11px] font-semibold uppercase text-emerald-400">
                  Artista Mais Conector (Bridge Node)
                </span>
                <p className="text-base font-bold text-white mt-0.5">
                  {graphData.metadata.bridge_artist.name}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Maior Centralidade de Intermediação (Betweenness:{" "}
                  {graphData.metadata.bridge_artist.betweenness_centrality}).
                </p>
              </div>
            )}

            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Seus Clusters Principais
            </h3>
            <div className="space-y-2">
              {graphData.metadata.clusters?.slice(0, 5).map((cluster) => (
                <div
                  key={cluster.cluster_id}
                  className="flex items-center justify-between rounded-lg bg-zinc-950/70 px-3 py-2 border border-zinc-800/60"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: cluster.color }}
                    />
                    <span className="text-xs font-medium text-zinc-200 capitalize">
                      {cluster.dominant_genres.join(" • ")}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-zinc-400">
                    {cluster.artist_count} art.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inspector de Nó (Artista ou Gênero) */}
        {activeNode ? (
          <div className="border-t border-zinc-800 pt-5">
            <div className="flex items-center gap-4">
              {activeNode.image_url ? (
                <img
                  src={activeNode.image_url}
                  alt={activeNode.name}
                  className="h-16 w-16 rounded-full object-cover border-2"
                  style={{ borderColor: activeNode.color }}
                />
              ) : (
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl border-2 bg-zinc-950 text-sm font-bold"
                  style={{ borderColor: activeNode.color, color: activeNode.color }}
                >
                  {activeNode.node_type === "genre" ? "#" : activeNode.name.slice(0, 2)}
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-zinc-400">
                  {activeNode.node_type === "genre"
                    ? `Hub de Gênero (${activeNode.connected_artists_count} artistas)`
                    : `Rank #${activeNode.affinity_rank} no seu perfil`}
                </span>
                <h3 className="text-lg font-bold text-white">{activeNode.name}</h3>
                <span className="text-xs text-zinc-400">
                  Centralidade de Grau: {activeNode.metrics?.degree_centrality}
                </span>
              </div>
            </div>

            {activeNode.node_type === "artist" && (
              <>
                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase text-zinc-400 mb-2">
                    Gêneros Associados
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {activeNode.genres?.length > 0 ? (
                      activeNode.genres.map((g) => (
                        <span
                          key={g}
                          className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-200 capitalize"
                        >
                          {g}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-500">Sem gêneros catalogados</span>
                    )}
                  </div>
                </div>

                {activeNode.top_tracks?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold uppercase text-zinc-400 mb-2">
                      Faixas no Seu Perfil
                    </h4>
                    <ul className="space-y-2">
                      {activeNode.top_tracks.map((track) => (
                        <li
                          key={track.id}
                          className="flex items-center gap-2.5 rounded-lg bg-zinc-950/80 p-2 border border-zinc-800/60"
                        >
                          {track.album_image && (
                            <img
                              src={track.album_image}
                              alt={track.name}
                              className="h-8 w-8 rounded object-cover"
                            />
                          )}
                          <span className="text-xs font-medium text-zinc-200 truncate">
                            {track.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="border-t border-zinc-800 pt-5 text-xs text-zinc-500">
            Passe o mouse ou clique em um nó (Artista ou Gênero) para destacar suas
            conexões diretas e inspecionar suas métricas de rede.
          </div>
        )}
      </aside>
    </div>
  );
}
