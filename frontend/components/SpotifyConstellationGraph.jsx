"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import * as d3 from "d3-force";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  RotateCcw,
  Box,
  Layers,
  Search,
  X,
  Music,
  AlertTriangle,
  Info,
} from "lucide-react";

// Carregamento dinâmico estritamente no cliente para evitar erros de SSR com window/WebGL
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });
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

/**
 * [SEC-03] Sanitiza strings para interpolação segura em HTML/tooltips
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Cria textura de canvas de alta nitidez para rótulo tridimensional legível em Three.js
 */
function createLabelSprite(text, color, radius, isGenre) {
  if (typeof document === "undefined") return new THREE.Group();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const width = 512;
  const height = 128;
  canvas.width = width;
  canvas.height = height;

  // Fundo em formato pill com alto contraste e borda luminosa temática
  ctx.fillStyle = isGenre ? "rgba(8, 12, 22, 0.94)" : "rgba(10, 12, 18, 0.90)";
  ctx.strokeStyle = color || (isGenre ? "#38BDF8" : "#1DB954");
  ctx.lineWidth = isGenre ? 6 : 5;

  const r = 30;
  const x = 10;
  const y = 10;
  const w = width - 20;
  const h = height - 20;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Texto nítido em alta resolução
  ctx.font = `${isGenre ? "800 38px" : "700 36px"} Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isGenre ? "#F8FAFC" : "#FFFFFF";

  const maxLen = isGenre ? 20 : 18;
  const displayText = text.length > maxLen ? text.slice(0, maxLen - 2) + "…" : text;
  ctx.fillText(displayText, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 1.0,
  });

  const sprite = new THREE.Sprite(spriteMat);
  const spriteWidth = isGenre ? Math.max(radius * 3.4, 30) : Math.max(radius * 2.8, 22);
  const spriteHeight = spriteWidth * (height / width);
  sprite.scale.set(spriteWidth, spriteHeight, 1);
  sprite.position.set(0, radius + spriteHeight * 0.68 + 2, 0);
  sprite.userData = {
    baseWidth: spriteWidth,
    baseHeight: spriteHeight,
    isGenre,
  };

  // Evita interceptação indevida de cliques no padding do sprite
  sprite.raycast = () => null;

  return sprite;
}

export default function SpotifyConstellationGraph() {
  const fgRef = useRef(null);
  const imageCache2D = useRef({});
  const textures3D = useRef({});
  const hasInitialFitted = useRef(false);
  const searchInputRef = useRef(null);

  // Estados dos dados e controles
  const [graphData, setGraphData] = useState({ metadata: null, nodes: [], links: [] });
  const [timeRange, setTimeRange] = useState("medium_term");
  const [graphMode, setGraphMode] = useState("artists");
  const [demoMode, setDemoMode] = useState(false);
  const [minEdgeWeight, setMinEdgeWeight] = useState(0.15);
  const [hoverNode, setHoverNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Estados de visualização e acessibilidade
  const [is3D, setIs3D] = useState(true);
  const [webGlAvailable, setWebGlAvailable] = useState(true);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTypeFilter, setSearchTypeFilter] = useState("all");

  // Detecção de compatibilidade WebGL no cliente
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const canvas = document.createElement("canvas");
      const gl = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
      setWebGlAvailable(gl);
      if (!gl) {
        setIs3D(false);
      }
    } catch {
      setWebGlAvailable(false);
      setIs3D(false);
    }
  }, []);

  // [DEV-03] Limpeza de recursos e texturas Three.js para liberar memória da GPU ao desmontar
  useEffect(() => {
    const cachedTextures = textures3D.current;
    return () => {
      if (cachedTextures) {
        Object.values(cachedTextures).forEach((texture) => {
          if (texture && typeof texture.dispose === "function") {
            texture.dispose();
          }
        });
      }
    };
  }, []);

  // Detecção de acessibilidade: prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (event) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  // Atalho de teclado para abrir busca acessível ('/' ou Esc para fechar)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(e.target?.tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  // Foco automático ao abrir o modal de busca
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [isSearchOpen]);

  // Carregamento de dados da API
  useEffect(() => {
    let active = true;
    setLoading(true);
    setAuthError(null);
    hasInitialFitted.current = false;

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

        // Pré-cache para renderização 2D Canvas
        data.nodes.forEach((node) => {
          if (node.image_url && !imageCache2D.current[node.id]) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = node.image_url;
            imageCache2D.current[node.id] = img;
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

  // Grafo filtrado pelo limiar de aresta
  const filteredGraph = useMemo(() => {
    const validLinks = (graphData.links || []).filter((l) => (l.weight || 0) >= minEdgeWeight);
    return {
      nodes: graphData.nodes || [],
      links: validLinks,
    };
  }, [graphData, minEdgeWeight]);

  // Verifica se há ausência de gêneros reportada pela API ou no modo bipartido
  const hasEmptyGenres = useMemo(() => {
    if (graphData.metadata?.empty_genres) return true;
    if (
      !loading &&
      graphMode === "bipartite" &&
      filteredGraph.nodes.length > 0 &&
      !filteredGraph.nodes.some((n) => n.node_type === "genre")
    ) {
      return true;
    }
    return false;
  }, [graphData.metadata, loading, graphMode, filteredGraph.nodes]);

  const activeNode = hoverNode || selectedNode;

  // Conjunto de nós e arestas destacados (1-hop)
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

  // Vizinhos diretos do nó ativo (ordenados por peso de conexão)
  const directNeighbors = useMemo(() => {
    if (!activeNode) return [];
    const neighborMap = new Map();

    filteredGraph.links.forEach((l) => {
      const sId = typeof l.source === "object" ? l.source.id : l.source;
      const tId = typeof l.target === "object" ? l.target.id : l.target;
      if (sId === activeNode.id) {
        neighborMap.set(tId, l.weight);
      } else if (tId === activeNode.id) {
        neighborMap.set(sId, l.weight);
      }
    });

    return filteredGraph.nodes
      .filter((n) => neighborMap.has(n.id))
      .map((n) => ({
        ...n,
        linkWeight: neighborMap.get(n.id),
      }))
      .sort((a, b) => (b.linkWeight || 0) - (a.linkWeight || 0));
  }, [activeNode, filteredGraph]);

  // Nós filtrados para o modal de busca acessível
  const searchableNodes = useMemo(() => {
    let list = filteredGraph.nodes;
    if (searchTypeFilter !== "all") {
      list = list.filter((n) => n.node_type === searchTypeFilter);
    }
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.genres && n.genres.some((g) => g.toLowerCase().includes(q)))
    );
  }, [filteredGraph.nodes, searchQuery, searchTypeFilter]);

  // Injeção de iluminação Three.js rica na cena 3D (AmbientLight + DirectionalLight + PointLight)
  const setupSceneLighting = useCallback(() => {
    if (!fgRef.current || !is3D) return;
    const scene = fgRef.current.scene?.();
    if (!scene || scene.userData?.customLightsAdded) return;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    ambientLight.name = "beatcode-ambient-light";

    const dirLightMain = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLightMain.position.set(180, 240, 200);
    dirLightMain.name = "beatcode-dir-light-main";

    const dirLightFill = new THREE.DirectionalLight(0x93c5fd, 0.75);
    dirLightFill.position.set(-180, -150, -160);
    dirLightFill.name = "beatcode-dir-light-fill";

    const pointLightCenter = new THREE.PointLight(0x1db954, 0.85, 650);
    pointLightCenter.position.set(0, 0, 0);
    pointLightCenter.name = "beatcode-point-light";

    scene.add(ambientLight, dirLightMain, dirLightFill, pointLightCenter);
    scene.userData = { ...scene.userData, customLightsAdded: true };
  }, [is3D]);

  // Calibração das forças físicas 3D/2D para manter clusters orgânicos e coesos
  const configureGraphForces = useCallback(() => {
    if (!fgRef.current) return;

    if (is3D) {
      setupSceneLighting();
      fgRef.current.d3Force?.("charge")?.strength(graphMode === "bipartite" ? -110 : -120);
      fgRef.current
        ?.d3Force?.("link")
        ?.distance?.((link) =>
          graphMode === "bipartite" ? 56 : 76 * (1.15 - Math.min(link.weight || 0.25, 0.8))
        );
      if (d3?.forceCollide) {
        fgRef.current.d3Force?.("collide", d3.forceCollide((node) => (node.val || 12) * 0.72 + 5));
      }
    } else {
      fgRef.current.d3Force?.("charge")?.strength(graphMode === "bipartite" ? -180 : -220);
      fgRef.current
        ?.d3Force?.("link")
        ?.distance?.((link) => (graphMode === "bipartite" ? 75 : 105 * (1.15 - (link.weight || 0.2))));
      if (d3?.forceCollide) {
        fgRef.current.d3Force?.("collide", d3.forceCollide((node) => (node.val || 12) + 8));
      }
    }
  }, [graphMode, is3D, setupSceneLighting]);

  useEffect(() => {
    configureGraphForces();
    const timer = setTimeout(configureGraphForces, 80);
    return () => clearTimeout(timer);
  }, [graphData, graphMode, is3D, loading, configureGraphForces]);

  // Atualização dinâmica de destaques, emissividade e rótulos em Three.js sem recriar malhas
  useEffect(() => {
    if (!is3D || !filteredGraph?.nodes) return;

    filteredGraph.nodes.forEach((node) => {
      const group = node.__threeObj;
      if (!group || !group.userData) return;

      const { mainMesh, ringMesh, labelSprite } = group.userData;
      const isGenre = node.node_type === "genre";
      const isHighlighted = !activeNode || highlightNodes.has(node.id);
      const isFocused = Boolean(activeNode && activeNode.id === node.id);
      const defaultEmissiveIntensity = isGenre ? 0.35 : 0.2;

      if (mainMesh && mainMesh.material) {
        mainMesh.material.transparent = true;
        mainMesh.material.opacity = isHighlighted ? 1.0 : 0.24;
        if (mainMesh.material.emissive) {
          mainMesh.material.emissive.set(node.color || (isGenre ? "#3B82F6" : "#1DB954"));
          if (isFocused) {
            mainMesh.material.emissiveIntensity = 0.75;
          } else if (activeNode && isHighlighted) {
            mainMesh.material.emissiveIntensity = 0.48;
          } else if (!activeNode) {
            mainMesh.material.emissiveIntensity = defaultEmissiveIntensity;
          } else {
            mainMesh.material.emissiveIntensity = 0.08;
          }
        }
      }

      if (ringMesh) {
        ringMesh.visible = Boolean(isGenre || (activeNode && isHighlighted));
        if (ringMesh.material) {
          ringMesh.material.opacity = isFocused
            ? 0.95
            : activeNode && isHighlighted
            ? 0.85
            : isGenre
            ? 0.42
            : 0.0;
          ringMesh.material.color.set(
            isFocused ? "#FFFFFF" : node.color || (isGenre ? "#38BDF8" : "#1DB954")
          );
        }
      }

      if (labelSprite) {
        const baseW = labelSprite.userData?.baseWidth || (isGenre ? 32 : 24);
        const baseH = labelSprite.userData?.baseHeight || (isGenre ? 8 : 6);

        if (isGenre) {
          // Hubs de gênero permanecem sempre visíveis por padrão no espaço 3D, ampliando no foco
          labelSprite.visible = true;
          if (labelSprite.material) {
            labelSprite.material.opacity = isHighlighted ? 1.0 : 0.45;
          }
          const scaleFactor = isFocused ? 1.32 : activeNode && isHighlighted ? 1.15 : 1.0;
          labelSprite.scale.set(baseW * scaleFactor, baseH * scaleFactor, 1);
        } else {
          labelSprite.visible = Boolean(isFocused || (activeNode && isHighlighted));
          const scaleFactor = isFocused ? 1.25 : 1.0;
          labelSprite.scale.set(baseW * scaleFactor, baseH * scaleFactor, 1);
        }
      }
    });
  }, [activeNode, highlightNodes, filteredGraph, is3D]);

  // Fábrica de objetos Three.js tridimensionais personalizados
  const createNode3DObject = useCallback(
    (node) => {
      setupSceneLighting();
      const isGenre = node.node_type === "genre";
      const group = new THREE.Group();

      if (isGenre) {
        // Nó de Gênero: Poliedro Icosaédrico facetado auto-iluminado com wireframe
        const radius = Math.max(Math.min((node.val || 14) * 0.74, 18), 8.5);
        const themeColor = node.color || "#38BDF8";
        const polyGeom = new THREE.IcosahedronGeometry(radius, 0);
        const polyMat = new THREE.MeshStandardMaterial({
          color: themeColor,
          emissive: new THREE.Color(themeColor),
          emissiveIntensity: 0.35,
          roughness: 0.25,
          metalness: 0.22,
          flatShading: true,
        });
        const polyMesh = new THREE.Mesh(polyGeom, polyMat);

        // Acento de aramado nítido (wireframe)
        const wireGeom = new THREE.WireframeGeometry(polyGeom);
        const wireMat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.48,
        });
        const wireframe = new THREE.LineSegments(wireGeom, wireMat);
        wireframe.raycast = () => null;

        // Anel halo permanente nos hubs de gênero (destacado ainda mais no foco)
        const ringGeom = new THREE.TorusGeometry(radius * 1.35, radius * 0.08, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: themeColor,
          transparent: true,
          opacity: 0.42,
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = Math.PI / 4;
        ringMesh.visible = true;
        ringMesh.raycast = () => null;

        // Sprite de rótulo 3D sempre visível por padrão para gêneros
        const labelSprite = createLabelSprite(`# ${node.name}`, themeColor, radius, true);
        labelSprite.visible = true;

        group.add(polyMesh);
        group.add(wireframe);
        group.add(ringMesh);
        group.add(labelSprite);
        group.userData = { mainMesh: polyMesh, ringMesh, labelSprite, node };
      } else {
        // Nó de Artista: Esfera texturizada com foto ou cor da comunidade e brilho emissivo
        const radius = Math.max(Math.min((node.val || 12) * 0.66, 16), 6.5);
        const artistColor = node.color || "#1DB954";
        const sphereGeom = new THREE.SphereGeometry(radius, 32, 24);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: artistColor,
          emissive: new THREE.Color(artistColor),
          emissiveIntensity: 0.2,
          roughness: 0.32,
          metalness: 0.12,
        });

        if (node.image_url) {
          if (textures3D.current[node.id]) {
            sphereMat.map = textures3D.current[node.id];
            sphereMat.color.setHex(0xffffff);
            sphereMat.needsUpdate = true;
          } else {
            const loader = new THREE.TextureLoader();
            loader.setCrossOrigin("anonymous");
            loader.load(
              node.image_url,
              (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                textures3D.current[node.id] = tex;
                sphereMat.map = tex;
                sphereMat.color.setHex(0xffffff);
                sphereMat.needsUpdate = true;
              },
              undefined,
              () => {
                // Mantém a cor temática da comunidade em caso de falha de carregamento
              }
            );
          }
        }

        const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);

        // Anel de destaque halo
        const ringGeom = new THREE.TorusGeometry(radius * 1.32, radius * 0.08, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: artistColor,
          transparent: true,
          opacity: 0.9,
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = Math.PI / 4;
        ringMesh.visible = false;
        ringMesh.raycast = () => null;

        // Sprite de rótulo
        const labelSprite = createLabelSprite(node.name, artistColor, radius, false);
        labelSprite.visible = false;

        group.add(sphereMesh);
        group.add(ringMesh);
        group.add(labelSprite);
        group.userData = { mainMesh: sphereMesh, ringMesh, labelSprite, node };
      }

      return group;
    },
    [setupSceneLighting]
  );

  // Pintura 2D Canvas Fallback
  const paintNode2D = useCallback(
    (node, ctx, globalScale) => {
      if (node.x === undefined || node.y === undefined) return;

      const isHighlighted = !activeNode || highlightNodes.has(node.id);
      const isFocused = activeNode && activeNode.id === node.id;
      const radius = node.val || 14;

      ctx.save();
      ctx.globalAlpha = isHighlighted ? 1.0 : 0.18;

      if (isFocused) {
        ctx.shadowColor = node.color;
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
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.closePath();
        ctx.save();
        ctx.clip();

        const img = imageCache2D.current[node.id];
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

  // Centralização de câmera suave em nó selecionado
  const focusOnNode = useCallback(
    (node) => {
      setSelectedNode(node);
      if (!fgRef.current || !node) return;

      if (is3D) {
        const nx = node.x || 0;
        const ny = node.y || 0;
        const nz = node.z || 0;
        const distance = 140;
        const distRatio = 1 + distance / (Math.hypot(nx, ny, nz) || 1);

        const newPos = {
          x: nx * distRatio,
          y: ny * distRatio + 15,
          z: nz * distRatio + 40,
        };

        fgRef.current.cameraPosition(
          newPos,
          { x: nx, y: ny, z: nz },
          prefersReducedMotion ? 0 : 850
        );
      } else {
        if (node.x !== undefined && node.y !== undefined) {
          fgRef.current.centerAt(node.x, node.y, prefersReducedMotion ? 0 : 600);
          fgRef.current.zoom(2.1, prefersReducedMotion ? 0 : 600);
        }
      }
    },
    [is3D, prefersReducedMotion]
  );

  // Controles de câmera e HUD
  const handleZoomIn = useCallback(() => {
    if (!fgRef.current) return;
    if (is3D) {
      const pos = fgRef.current.cameraPosition();
      fgRef.current.cameraPosition(
        { x: pos.x * 0.72, y: pos.y * 0.72, z: pos.z * 0.72 },
        undefined,
        prefersReducedMotion ? 0 : 350
      );
    } else {
      fgRef.current.zoom((fgRef.current.zoom() || 1) * 1.35, prefersReducedMotion ? 0 : 350);
    }
  }, [is3D, prefersReducedMotion]);

  const handleZoomOut = useCallback(() => {
    if (!fgRef.current) return;
    if (is3D) {
      const pos = fgRef.current.cameraPosition();
      fgRef.current.cameraPosition(
        { x: pos.x * 1.38, y: pos.y * 1.38, z: pos.z * 1.38 },
        undefined,
        prefersReducedMotion ? 0 : 350
      );
    } else {
      fgRef.current.zoom((fgRef.current.zoom() || 1) * 0.72, prefersReducedMotion ? 0 : 350);
    }
  }, [is3D, prefersReducedMotion]);

  const handleZoomToFit = useCallback(() => {
    if (!fgRef.current) return;
    if (is3D) {
      fgRef.current.zoomToFit(prefersReducedMotion ? 0 : 800, 50);
    } else {
      fgRef.current.zoomToFit(prefersReducedMotion ? 0 : 600, 50);
    }
  }, [is3D, prefersReducedMotion]);

  const handleResetView = useCallback(() => {
    if (!fgRef.current) return;
    if (is3D) {
      fgRef.current.cameraPosition(
        { x: 0, y: 0, z: 320 },
        { x: 0, y: 0, z: 0 },
        prefersReducedMotion ? 0 : 800
      );
    } else {
      fgRef.current.centerAt(0, 0, prefersReducedMotion ? 0 : 600);
      fgRef.current.zoom(1, prefersReducedMotion ? 0 : 600);
    }
  }, [is3D, prefersReducedMotion]);

  const toggleAutoRotate = useCallback(() => {
    if (!fgRef.current || !is3D) return;
    const controls = fgRef.current.controls();
    if (controls) {
      const nextState = !isAutoRotating;
      controls.autoRotate = nextState;
      controls.autoRotateSpeed = 1.3;
      setIsAutoRotating(nextState);
    }
  }, [is3D, isAutoRotating]);

  const toggleDimension = useCallback(() => {
    if (!webGlAvailable && !is3D) return;
    setIs3D((prev) => !prev);
  }, [webGlAvailable, is3D]);

  // [SEC-03] Tooltip customizado em HTML com sanitização de campos interpolados
  const getNodeTooltip = useCallback((node) => {
    if (!node) return "";
    const isGenre = node.node_type === "genre";
    const typeLabel = isGenre
      ? "Gênero Musical"
      : `Rank #${escapeHtml(node.affinity_rank) || "-"}`;
    const degree = escapeHtml(node.metrics?.degree_centrality ?? "-");
    const safeName = escapeHtml(node.name || "");
    const safeColor = escapeHtml(node.color || "#1DB954");
    const safeGenres = Array.isArray(node.genres)
      ? node.genres.slice(0, 3).map(escapeHtml).join(", ")
      : "";

    return `
      <div style="background: rgba(13, 15, 22, 0.95); border: 1px solid ${safeColor}; border-radius: 8px; padding: 8px 12px; font-family: Inter, system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,0.6); color: #fff; font-size: 12px; pointer-events: none; line-height: 1.4;">
        <div style="font-weight: 700; font-size: 13px; color: ${safeColor}; margin-bottom: 2px;">
          ${isGenre ? "# " : ""}${safeName}
        </div>
        <div style="color: #a1a1aa; font-size: 11px;">
          ${typeLabel} &bull; Centralidade: ${degree}
        </div>
        ${
          safeGenres
            ? `<div style="color: #71717a; font-size: 10px; margin-top: 4px;">${safeGenres}</div>`
            : ""
        }
      </div>
    `;
  }, []);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#090A0F] text-zinc-100 font-sans">
      {/* Barra Superior de Controles Principais */}
      <header className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/90 px-4 py-2.5 backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-2 pr-2">
          <span className="h-3 w-3 rounded-full bg-[#1DB954] animate-pulse" />
          <h1 className="text-xs font-bold tracking-wider uppercase text-zinc-200">
            Spotify Music Graph
          </h1>
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-[#1DB954] border border-[#1DB954]/30">
            {is3D ? "3D Real" : "2D Canvas"}
          </span>
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
            aria-label="Limiar mínimo de peso das arestas"
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

        {/* Botão de Busca Acessível de Nós */}
        <div className="border-l border-zinc-800 pl-3">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-emerald-500/50 hover:text-white transition-all"
            title="Abrir busca acessível de nós (ou pressione /)"
            aria-label="Abrir busca e inspeção de nós"
          >
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <span>Buscar Nós</span>
            <kbd className="hidden sm:inline-block rounded bg-zinc-950 px-1 py-0.2 text-[10px] text-zinc-400 font-mono">
              /
            </kbd>
          </button>
        </div>
      </header>

      {/* Alerta de fallback caso WebGL seja indisponível */}
      {!webGlAvailable && (
        <div
          className="absolute top-20 left-4 right-4 z-20 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-950/80 p-3 text-xs text-amber-200 backdrop-blur-md shadow-xl"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>Aceleração WebGL não detectada:</strong> O BeatCode alternou automaticamente
              para a visualização 2D Canvas de alta fidelidade. Todas as métricas, filtros e seleções
              permanecem ativas.
            </span>
          </div>
        </div>
      )}

      {/* Banner sutil informativo quando os artistas não possuem gêneros catalogados */}
      {hasEmptyGenres && !loading && !authError && (
        <div
          className="absolute top-20 left-4 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-500/40 bg-zinc-900/95 px-4 py-2.5 text-xs text-zinc-200 backdrop-blur-md shadow-xl max-w-2xl"
          role="status"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-cyan-400" />
            <span>
              {graphData.metadata?.empty_genres_message ||
                "Os artistas retornados pelo Spotify neste período possuem poucos ou nenhum gênero catalogado. Exibindo agrupamentos inferidos ou tente o Modo Demo."}
            </span>
          </div>
          {!demoMode && (
            <button
              onClick={() => setDemoMode(true)}
              className="rounded-lg bg-cyan-500/20 border border-cyan-400/50 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-all"
            >
              Experimentar Dataset Demo
            </button>
          )}
        </div>
      )}

      {/* Viewport do Grafo Principal */}
      <main className="flex-1 h-full relative">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1DB954] border-t-transparent" />
            <span>Calculando projeção 3D, clusters Louvain e topologia do gosto...</span>
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
        ) : is3D ? (
          <ForceGraph3D
            ref={fgRef}
            graphData={filteredGraph}
            backgroundColor="#090A0F"
            showNavInfo={false}
            nodeThreeObject={createNode3DObject}
            nodeThreeObjectExtend={false}
            nodeLabel={getNodeTooltip}
            onNodeHover={(node) => setHoverNode(node || null)}
            onNodeClick={(node) => {
              if (selectedNode?.id === node?.id) {
                setSelectedNode(null);
              } else {
                focusOnNode(node);
              }
            }}
            onBackgroundClick={() => {
              setSelectedNode(null);
              setHoverNode(null);
            }}
            linkWidth={(link) =>
              highlightLinks.has(link)
                ? Math.max((link.weight || 0.3) * 4.2 + 1.5, 2.4)
                : Math.max((link.weight || 0.3) * 2.2 + 0.6, 1.1)
            }
            linkColor={(link) => {
              if (!activeNode) {
                return graphMode === "bipartite"
                  ? "rgba(110, 231, 183, 0.52)"
                  : "rgba(161, 161, 170, 0.48)";
              }
              return highlightLinks.has(link)
                ? graphMode === "bipartite"
                  ? "rgba(34, 211, 238, 0.96)"
                  : "rgba(29, 185, 84, 0.96)"
                : "rgba(71, 85, 105, 0.14)";
            }}
            linkDirectionalParticles={(link) => (highlightLinks.has(link) ? 3 : 0)}
            linkDirectionalParticleWidth={2.8}
            linkDirectionalParticleSpeed={0.007}
            linkOpacity={0.9}
            warmupTicks={45}
            cooldownTicks={110}
            d3AlphaDecay={0.028}
            d3VelocityDecay={0.35}
            onEngineStop={() => {
              setupSceneLighting();
              if (!hasInitialFitted.current && fgRef.current) {
                fgRef.current.zoomToFit(prefersReducedMotion ? 0 : 750, 55);
                hasInitialFitted.current = true;
              }
            }}
          />
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={filteredGraph}
            backgroundColor="#090A0F"
            nodeRelSize={1}
            nodeVal={(node) => node.val}
            nodeCanvasObject={paintNode2D}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, (node.val || 14) + 2, 0, 2 * Math.PI, false);
              ctx.fill();
            }}
            onNodeHover={(node) => setHoverNode(node || null)}
            onNodeClick={(node) => {
              if (selectedNode?.id === node?.id) {
                setSelectedNode(null);
              } else {
                focusOnNode(node);
              }
            }}
            onBackgroundClick={() => {
              setSelectedNode(null);
              setHoverNode(null);
            }}
            linkWidth={(link) =>
              highlightLinks.has(link) ? link.weight * 4.5 : Math.max(link.weight * 2.2, 1.0)
            }
            linkColor={(link) => {
              if (!activeNode) return "rgba(161, 161, 170, 0.45)";
              return highlightLinks.has(link)
                ? "rgba(29, 185, 84, 0.92)"
                : "rgba(63, 63, 70, 0.12)";
            }}
            linkDirectionalParticles={(link) => (highlightLinks.has(link) ? 2 : 0)}
            linkDirectionalParticleWidth={3}
            cooldownTicks={130}
          />
        )}

        {/* Guia Visual de Navegação por Mouse / Gestos */}
        <div className="absolute bottom-6 left-6 z-10 hidden sm:flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3 py-1.5 text-[11px] text-zinc-400 backdrop-blur-md">
          <Info className="h-3.5 w-3.5 text-zinc-500" />
          <span>
            {is3D
              ? "Girar: Arraste Esq. • Pan: Arraste Dir. • Zoom: Roda do mouse"
              : "Pan: Arraste Esq. • Zoom: Roda do mouse • Clique para focar"}
          </span>
        </div>

        {/* HUD Flutuante de Câmera 3D */}
        <div
          className="absolute bottom-6 right-6 z-20 flex items-center gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/95 p-1.5 backdrop-blur-md shadow-2xl"
          role="toolbar"
          aria-label="Controles de Câmera e Visualização"
        >
          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/70 text-zinc-300 hover:bg-[#1DB954] hover:text-black transition-all"
            title="Aproximar Câmera (Zoom In)"
            aria-label="Aproximar Câmera"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/70 text-zinc-300 hover:bg-[#1DB954] hover:text-black transition-all"
            title="Afastar Câmera (Zoom Out)"
            aria-label="Afastar Câmera"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          {/* Orbit / Rotação Automática (apenas 3D) */}
          {is3D && (
            <button
              onClick={toggleAutoRotate}
              disabled={prefersReducedMotion}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                isAutoRotating
                  ? "bg-[#1DB954] text-black shadow-lg shadow-emerald-500/20"
                  : "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700"
              } ${prefersReducedMotion ? "opacity-40 cursor-not-allowed" : ""}`}
              title={
                prefersReducedMotion
                  ? "Rotação desativada por preferência de movimento reduzido"
                  : "Alternar Rotação Automática (Orbit)"
              }
              aria-label="Alternar Rotação Automática"
            >
              <RotateCw className={`h-4 w-4 ${isAutoRotating ? "animate-spin" : ""}`} />
            </button>
          )}

          {/* Enquadrar Grafo */}
          <button
            onClick={handleZoomToFit}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/70 text-zinc-300 hover:bg-[#1DB954] hover:text-black transition-all"
            title="Enquadrar Todos os Nós Visíveis (Zoom to Fit)"
            aria-label="Enquadrar Grafo"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Resetar Visão */}
          <button
            onClick={handleResetView}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/70 text-zinc-300 hover:bg-[#1DB954] hover:text-black transition-all"
            title="Restaurar Visão Padrão da Câmera"
            aria-label="Resetar Visão da Câmera"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Separador */}
          <div className="h-5 w-[1px] bg-zinc-700/60 mx-1" />

          {/* Alternador 3D / 2D */}
          <button
            onClick={toggleDimension}
            disabled={!webGlAvailable}
            className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold transition-all ${
              is3D
                ? "bg-emerald-500/20 text-[#1DB954] border border-[#1DB954]/50"
                : "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700"
            } ${!webGlAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
            title={
              !webGlAvailable
                ? "WebGL indisponível neste navegador"
                : is3D
                ? "Alternar para Modo 2D"
                : "Alternar para Modo 3D"
            }
            aria-label="Alternar Modo 3D e 2D"
          >
            {is3D ? <Box className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
            <span>{is3D ? "3D" : "2D"}</span>
          </button>
        </div>
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

        {/* Inspector de Nó Sincronizado */}
        {activeNode ? (
          <div className="border-t border-zinc-800 pt-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Nó Selecionado
              </span>
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setHoverNode(null);
                }}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
                title="Desmarcar seleção"
                aria-label="Fechar detalhes do nó"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {activeNode.image_url ? (
                <img
                  src={activeNode.image_url}
                  alt={activeNode.name}
                  className="h-16 w-16 rounded-full object-cover border-2 shadow-lg"
                  style={{ borderColor: activeNode.color }}
                />
              ) : (
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl border-2 bg-zinc-950 text-sm font-bold shadow-lg"
                  style={{ borderColor: activeNode.color, color: activeNode.color }}
                >
                  {activeNode.node_type === "genre" ? "#" : activeNode.name.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-zinc-400 block truncate">
                  {activeNode.node_type === "genre"
                    ? `Hub de Gênero (${activeNode.connected_artists_count || directNeighbors.length} artistas)`
                    : `Rank #${activeNode.affinity_rank} no seu perfil`}
                </span>
                <h3 className="text-lg font-bold text-white truncate">{activeNode.name}</h3>
                <span className="text-xs text-zinc-400 block">
                  Centralidade de Grau: {activeNode.metrics?.degree_centrality}
                </span>
              </div>
            </div>

            {/* Informações detalhadas se for Artista */}
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

            {/* Lista de Vizinhos Diretos Clicáveis */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase text-zinc-400">
                  Vizinhos Conectados ({directNeighbors.length})
                </h4>
                <span className="text-[10px] text-zinc-500">Clique para inspecionar</span>
              </div>

              {directNeighbors.length > 0 ? (
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {directNeighbors.map((nb) => (
                    <button
                      key={nb.id}
                      onClick={() => focusOnNode(nb)}
                      className="w-full flex items-center justify-between gap-2 rounded-lg bg-zinc-950/80 px-2.5 py-1.5 border border-zinc-800/60 hover:border-emerald-500/50 hover:bg-zinc-800/60 transition-all text-left"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: nb.color || "#1DB954" }}
                        />
                        <span className="text-xs font-medium text-zinc-200 truncate">
                          {nb.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                        peso {(nb.linkWeight || 0).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">
                  Nenhuma conexão acima do limiar atual ({minEdgeWeight.toFixed(2)}).
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="border-t border-zinc-800 pt-5 text-xs text-zinc-400 flex flex-col gap-3">
            <p>
              Passe o cursor ou clique em um nó no espaço 3D para destacar conexões imediatas e
              inspecionar detalhes de rede.
            </p>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:border-emerald-500/50 hover:text-white transition-all"
            >
              <Search className="h-3.5 w-3.5 text-[#1DB954]" />
              Explorar Lista Completa de Nós
            </button>
          </div>
        )}
      </aside>

      {/* Modal / Drawer Acessível de Busca e Inspeção de Nós */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Busca e inspeção acessível de nós"
        >
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Cabeçalho da Busca */}
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-[#1DB954]" />
                <h2 className="text-sm font-bold text-white">Explorador de Nós do Grafo</h2>
              </div>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
                aria-label="Fechar busca"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Input e Filtros */}
            <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-col gap-3">
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nome do artista, gênero ou hub..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-[#1DB954] focus:outline-none focus:ring-1 focus:ring-[#1DB954]"
                aria-label="Buscar artista ou gênero"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Tipo:</span>
                <button
                  onClick={() => setSearchTypeFilter("all")}
                  className={`px-2.5 py-0.5 text-xs rounded-md font-medium transition-all ${
                    searchTypeFilter === "all"
                      ? "bg-[#1DB954] text-black font-semibold"
                      : "bg-zinc-800 text-zinc-300 hover:text-white"
                  }`}
                >
                  Todos ({filteredGraph.nodes.length})
                </button>
                <button
                  onClick={() => setSearchTypeFilter("artist")}
                  className={`px-2.5 py-0.5 text-xs rounded-md font-medium transition-all ${
                    searchTypeFilter === "artist"
                      ? "bg-[#1DB954] text-black font-semibold"
                      : "bg-zinc-800 text-zinc-300 hover:text-white"
                  }`}
                >
                  Artistas ({filteredGraph.nodes.filter((n) => n.node_type !== "genre").length})
                </button>
                {graphMode === "bipartite" && (
                  <button
                    onClick={() => setSearchTypeFilter("genre")}
                    className={`px-2.5 py-0.5 text-xs rounded-md font-medium transition-all ${
                      searchTypeFilter === "genre"
                        ? "bg-[#1DB954] text-black font-semibold"
                        : "bg-zinc-800 text-zinc-300 hover:text-white"
                    }`}
                  >
                    Gêneros ({filteredGraph.nodes.filter((n) => n.node_type === "genre").length})
                  </button>
                )}
              </div>
            </div>

            {/* Lista Rolável de Resultados */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {searchableNodes.length > 0 ? (
                searchableNodes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      focusOnNode(n);
                      setIsSearchOpen(false);
                    }}
                    className="w-full flex items-center justify-between rounded-xl bg-zinc-950/70 p-3 border border-zinc-800/80 hover:border-emerald-500/60 hover:bg-zinc-800/50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {n.image_url ? (
                        <img
                          src={n.image_url}
                          alt={n.name}
                          className="h-10 w-10 rounded-full object-cover border shrink-0"
                          style={{ borderColor: n.color || "#1DB954" }}
                        />
                      ) : (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl border bg-zinc-900 text-xs font-bold shrink-0"
                          style={{ borderColor: n.color || "#1DB954", color: n.color || "#1DB954" }}
                        >
                          {n.node_type === "genre" ? "#" : n.name.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-white group-hover:text-emerald-300 truncate block">
                          {n.name}
                        </span>
                        <span className="text-xs text-zinc-400 block truncate">
                          {n.node_type === "genre"
                            ? "Hub de Gênero Musical"
                            : n.genres?.slice(0, 3).join(", ") || "Artista"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono text-[#1DB954] block">
                        grau {n.metrics?.degree_centrality ?? "-"}
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        {n.node_type === "genre" ? "Gênero" : `Rank #${n.affinity_rank || "-"}`}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-12 text-center text-sm text-zinc-500">
                  Nenhum nó encontrado para &ldquo;{searchQuery}&rdquo;.
                </div>
              )}
            </div>

            {/* Rodapé Acessível com Dicas */}
            <div className="border-t border-zinc-800 bg-zinc-950/80 p-3 px-4 flex items-center justify-between text-xs text-zinc-500">
              <span>Pressione ESC para fechar ou clique em um nó para focar a câmera.</span>
              <kbd className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                ESC
              </kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
