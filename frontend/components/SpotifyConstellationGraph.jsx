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
  const graphContainerRef = useRef(null);
  const imageCache = useRef({});

  const [graphData, setGraphData] = useState({ metadata: null, nodes: [], links: [] });
  const [timeRange, setTimeRange] = useState("medium_term");
  const [graphMode, setGraphMode] = useState("artists");
  const [experience, setExperience] = useState("checking");
  const [minEdgeWeight, setMinEdgeWeight] = useState(0.15);
  const [hoverNode, setHoverNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [graphSize, setGraphSize] = useState({ width: 800, height: 600 });

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
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const container = graphContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setGraphSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [experience]);

  useEffect(() => {
    if (experience !== "demo" && experience !== "spotify") return;
    let active = true;
    setLoading(true);
    setGraphError(null);
    setGraphData({ metadata: null, nodes: [], links: [] });
    setSelectedNode(null);
    setHoverNode(null);

    const url = `${API_BASE_URL}/api/graph?time_range=${timeRange}&graph_mode=${graphMode}&limit=50&demo=${experience === "demo"}`;

    fetch(url, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const retryAfter = res.headers.get("Retry-After");
          const waitHint = res.status === 429 && /^\d+$/.test(retryAfter || "")
            ? ` Tente novamente em ${retryAfter} segundos.` : "";
          const error = new Error((body.detail || `Não foi possível carregar o grafo (${res.status}).`) + waitHint);
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
        setGraphError({
          message: err instanceof TypeError ? "Não foi possível conectar ao servidor local. Confira se o backend está em execução." : err.message,
          status: err.status || 0,
        });
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [timeRange, graphMode, experience, retryCount]);

  useEffect(() => {
    if (!fgRef.current) return;
    fgRef.current.d3Force("charge").strength(graphMode === "bipartite" ? -210 : -260);
    fgRef.current
      .d3Force("link")
      .distance((link) => (graphMode === "bipartite" ? 85 : 115 * (1.15 - (link.weight || 0.2))));
    fgRef.current.d3Force("collide", d3.forceCollide((node) => (node.val || 12) + 8));
  }, [graphData, graphMode]);

  useEffect(() => {
    if (loading || graphError || graphData.nodes.length === 0) return;
    const frame = requestAnimationFrame(() => fgRef.current?.zoomToFit(300, 32));
    return () => cancelAnimationFrame(frame);
  }, [graphSize, loading, graphError, graphData]);

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

  const focusNode = (node) => {
    setSelectedNode((previous) => previous?.id === node.id ? null : node);
    fgRef.current?.centerAt(node.x, node.y, 400);
    fgRef.current?.zoom(2.1, 400);
  };

  const leaveGraph = async () => {
    if (experience === "spotify") {
      setLoggingOut(true);
      try {
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok) throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
      } catch (error) {
        setGraphError({ message: error.message, status: 0 });
        setLoggingOut(false);
        return;
      }
      setLoggingOut(false);
    }
    setGraphData({ metadata: null, nodes: [], links: [] });
    setSelectedNode(null);
    setHoverNode(null);
    setGraphError(null);
    setExperience("welcome");
  };

  if (experience === "checking") {
    return <div className="flex min-h-dvh items-center justify-center bg-[#090A0F] text-zinc-300" role="status">Verificando sessão...</div>;
  }

  if (experience === "welcome") {
    return (
      <main className="beatcode-welcome min-h-dvh overflow-y-auto bg-[#090A0F] text-zinc-100">
        <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-6 py-7 sm:px-10">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-zinc-300">
            <span className="h-3 w-3 rounded-full bg-[#1DB954] shadow-[0_0_22px_#1DB954]" aria-hidden="true" />
            BeatCode <span className="font-normal text-zinc-500">/ mapa musical</span>
          </div>
          <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="relative z-10 max-w-xl">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">Seu gosto tem forma</p>
              <h1 className="text-5xl font-black leading-[0.98] tracking-[-0.06em] sm:text-7xl">
                Ouça as conexões.<br /><span className="text-[#1DB954]">Veja a rede.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-zinc-400">
                Explore artistas, gêneros e comunidades em um mapa interativo da sua música. Escolha como começar.
              </p>
              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                <a href={`${API_BASE_URL}/auth/login`} className="group rounded-2xl border border-emerald-500/40 bg-emerald-500 p-5 text-zinc-950 shadow-[0_12px_50px_rgba(29,185,84,0.16)] transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                  <span className="text-xs font-bold uppercase tracking-widest">Sua biblioteca</span>
                  <strong className="mt-5 block text-xl leading-tight">Conectar minha conta Spotify ↗</strong>
                  <span className="mt-3 block text-sm text-emerald-950/80">Entre com sua conta para explorar seus artistas.</span>
                </a>
                <button type="button" onClick={() => setExperience("demo")} className="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5 text-left transition hover:border-amber-400/70 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Sem login</span>
                  <strong className="mt-5 block text-xl leading-tight text-zinc-100">Explorar demonstração →</strong>
                  <span className="mt-3 block text-sm text-zinc-400">Experimente os dois grafos com dados de exemplo.</span>
                </button>
              </div>
              <p className="mt-5 text-xs text-zinc-500">Suas credenciais Spotify não são mostradas ao BeatCode. A demonstração não usa sua conta.</p>
            </div>
            <div className="constellation-preview relative min-h-[360px] lg:min-h-[620px]" aria-hidden="true">
              <div className="preview-orbit preview-orbit-one" />
              <div className="preview-orbit preview-orbit-two" />
              <span className="preview-node preview-node-a">A</span>
              <span className="preview-node preview-node-b">B</span>
              <span className="preview-node preview-node-c">C</span>
              <span className="preview-node preview-node-d">D</span>
              <span className="preview-node preview-node-e">E</span>
              <span className="preview-node preview-node-f">#</span>
              <span className="preview-caption">ARTISTAS · GÊNEROS · COMUNIDADES</span>
            </div>
          </div>
          <p className="text-xs text-zinc-600">Uma visualização exploratória. As conexões são inferências do BeatCode a partir de dados do Spotify.</p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-y-auto bg-[#090A0F] font-sans text-zinc-100 lg:overflow-hidden">
      {/* Barra Superior de Controles */}
      <header className="z-20 flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-900/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2 pr-2">
          <span className="h-3 w-3 rounded-full bg-[#1DB954] animate-pulse" />
          <h1 className="text-xs font-bold tracking-wider uppercase text-zinc-200">
            BeatCode <span className="font-normal text-zinc-500">/ {experience === "demo" ? "demonstração" : "minha música"}</span>
          </h1>
        </div>

        {/* Alternador Unipartido vs Bipartido */}
        <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800" role="group" aria-label="Tipo de grafo">
          {GRAPH_MODES.map((gm) => (
            <button
              key={gm.key}
              type="button"
              onClick={() => setGraphMode(gm.key)}
              aria-pressed={graphMode === gm.key}
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
        <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800" role="group" aria-label="Período do Spotify">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.key}
              type="button"
              onClick={() => setTimeRange(tr.key)}
              aria-pressed={timeRange === tr.key}
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
          <label htmlFor="edge-threshold" className="text-xs text-zinc-400">
            Limiar: <strong className="text-zinc-200">{minEdgeWeight.toFixed(2)}</strong>
          </label>
          <input
            id="edge-threshold"
            type="range"
            min="0.05"
            max="0.65"
            step="0.02"
            value={minEdgeWeight}
            onChange={(e) => setMinEdgeWeight(parseFloat(e.target.value))}
            className="w-24 accent-[#1DB954] cursor-pointer"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => fgRef.current?.zoom((fgRef.current?.zoom() || 1) * 1.3, 250)} aria-label="Aproximar grafo" className="graph-tool">+</button>
          <button type="button" onClick={() => fgRef.current?.zoom((fgRef.current?.zoom() || 1) / 1.3, 250)} aria-label="Afastar grafo" className="graph-tool">−</button>
          <button type="button" onClick={() => fgRef.current?.zoomToFit(350, 40)} className="graph-tool px-2">Enquadrar</button>
          <button type="button" onClick={leaveGraph} disabled={loggingOut} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">
            {loggingOut ? "Saindo..." : experience === "spotify" ? "Sair" : "Voltar"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Canvas Principal */}
      <main ref={graphContainerRef} className="relative min-h-[52vh] min-w-0 flex-1 lg:min-h-0" aria-label="Mapa musical interativo">
        <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-xs rounded-xl border border-zinc-800/80 bg-zinc-950/85 px-4 py-3 text-xs text-zinc-300 backdrop-blur-sm">
          <strong className="block text-sm text-white">{graphMode === "artists" ? "Artista ↔ artista" : "Artista ↔ gênero"}</strong>
          <span>{graphMode === "artists" ? "As linhas representam afinidade inferida pelo BeatCode." : "Os hexágonos representam gêneros catalogados no Spotify."}</span>
        </div>
        {loading ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400" role="status">
            Montando seu mapa musical...
          </div>
        ) : graphError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-md text-sm text-zinc-300" role="alert">{graphError.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="rounded-xl border border-zinc-700 px-5 py-2.5 text-xs font-semibold hover:bg-zinc-800">Tentar novamente</button>
              {graphError.status === 401 && experience === "spotify" && <a href={`${API_BASE_URL}/auth/login`} className="rounded-xl bg-[#1DB954] px-5 py-2.5 text-xs font-bold text-black">Reconectar Spotify</a>}
              <button type="button" onClick={() => setExperience("demo")} className="rounded-xl border border-amber-500/60 px-5 py-2.5 text-xs font-semibold text-amber-300">Explorar demonstração</button>
            </div>
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400" role="status">Nenhum artista encontrado neste período. Escolha outro intervalo para explorar.</div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            width={graphSize.width}
            height={graphSize.height}
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
            onNodeClick={focusNode}
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
            onEngineStop={() => fgRef.current?.zoomToFit(300, 32)}
          />
        )}
      </main>

      {/* Painel Lateral Analítico */}
      <aside className="z-20 flex w-full shrink-0 flex-col gap-6 overflow-y-auto border-t border-zinc-800 bg-zinc-900/95 p-5 backdrop-blur-xl lg:w-[350px] lg:border-l lg:border-t-0">
        {graphData.metadata && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Topologia do seu gosto
              </h2>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">
                {graphMode === "bipartite" ? "Bipartido" : "Unipartido"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-zinc-950/90 p-3 border border-zinc-800/80">
                <span className="text-xs text-zinc-400">Modularidade (Q)</span>
                <p className="text-xl font-bold text-[#1DB954]">
                  {graphData.metadata.modularity_score ?? "—"}
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
                  Artista ponte
                </span>
                <p className="text-base font-bold text-white mt-0.5">
                  {graphData.metadata.bridge_artist.name}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Intermediação na rede: {graphData.metadata.bridge_artist.betweenness_centrality}. Métrica inferida pelo BeatCode.
                </p>
              </div>
            )}

            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Comunidades musicais
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

        {graphData.nodes.length > 0 && !loading && !graphError && (
          <div className="border-t border-zinc-800 pt-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Explorar por nome</h3>
            <p className="mb-3 text-xs text-zinc-500">Selecione um nó para focar o mapa. As cores indicam comunidades calculadas pelo BeatCode.</p>
            <div className="grid grid-cols-2 gap-1.5">
              {graphData.nodes.filter((node) => node.node_type === "artist").slice(0, 12).map((node) => (
                <button type="button" key={node.id} onClick={() => focusNode(node)} className="truncate rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-left text-xs text-zinc-300 hover:border-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" title={node.name}>
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: node.color }} aria-hidden="true" />
                  {node.name}
                </button>
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
    </div>
  );
}
