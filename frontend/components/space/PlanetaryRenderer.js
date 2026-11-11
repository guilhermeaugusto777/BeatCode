/**
 * PlanetaryRenderer.js — Graphify-Inspired 3D Knowledge Graph Renderer & GPU Lifecycle Guard
 *
 * Renders clean 3D Knowledge Graph nodes inspired by Graphify:
 * - Artists: high-contrast satin 3D spheres (THREE.SphereGeometry) with exact radius
 *   R_i = D_i / 2 = R_max * (L_i / L_max) proportional to listening counts.
 * - Genres: faceted 3D polyhedra (THREE.OctahedronGeometry) with exact radius
 *   R_g = D_g / 2 = R_max,genre * (L_g / L_max,genre).
 * - Invisible raycast hit-sphere (hitRadius = Math.max(radius, 4.5), opacity: 0, transparent: true)
 *   so lower-listening nodes remain effortless to hover and click without distorting visible proportion.
 * - Readable label sprite (createNodeLabelSprite) displaying node name and listening count/ratio.
 * - Deterministic GPU resource registry and disposal (disposeThreeUniverse).
 */

/* global document */

import * as THREE from "three";
import {
  computePlanetVisualProps,
  escapeHtml,
  sanitizeNodeColor,
  sanitizeNodeName,
} from "../../lib/spaceGraphModel.js";

/**
 * Creates an empty resource registry to track disposable Three.js resources.
 *
 * @returns {{ geometries: Set<THREE.BufferGeometry>, materials: Set<THREE.Material>, textures: Set<THREE.Texture>, sprites: Set<THREE.Sprite> }}
 */
export function createResourceRegistry() {
  return {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
    sprites: new Set(),
  };
}

/**
 * Resolves listening metrics (L_i, ratio L_i / L_max, rank, diameter D_i) from node and visualProps,
 * strictly differentiating observed_plays from estimated_listening_index.
 *
 * @param {Object} node
 * @param {Object} props
 * @returns {{ listeningCount: number, listeningRatio: number, listeningRank: number|null, diameter: number, radius: number, observedPlays: number|null, listeningMetricType: string, listeningMetricLabel: string }}
 */
export function resolveNodeListeningMetrics(node = {}, props = {}) {
  const isGenre =
    node?.node_type === "genre" ||
    props?.nodeType === "genre" ||
    props?.geometryType === "star_core" ||
    props?.geometryType === "genre_polyhedron";

  const radius =
    Number.isFinite(props?.radius) && props.radius > 0
      ? Number(props.radius)
      : isGenre
      ? 7.5
      : 5.0;

  const diameter = Number.isFinite(props?.diameter)
    ? Number(props.diameter)
    : Number((radius * 2).toFixed(2));

  const rawObserved =
    node?.observed_plays ??
    props?.observed_plays ??
    props?.observedPlays ??
    null;
  const observedPlays =
    Number.isFinite(Number(rawObserved)) && Number(rawObserved) >= 0
      ? Number(rawObserved)
      : null;

  const listeningMetricType =
    node?.listening_metric_type ??
    props?.listening_metric_type ??
    props?.listeningMetricType ??
    (observedPlays !== null && observedPlays > 0
      ? "observed_plays"
      : "estimated_listening_index");

  const listeningMetricLabel =
    node?.listening_metric_label ??
    props?.listening_metric_label ??
    props?.listeningMetricLabel ??
    (listeningMetricType === "observed_plays"
      ? "Reproduções Observadas"
      : "Índice Estimado de Escuta");

  const rawCount =
    node?.listening_count ??
    node?.listeningCount ??
    props?.listening_count ??
    props?.listeningCount ??
    (observedPlays !== null && observedPlays > 0
      ? observedPlays
      : isGenre
      ? node?.connected_artists_count ?? props?.connectedArtistsCount ?? 1
      : Math.max(1, Math.round((Number(node?.affinity_score) || 0.5) * 100)));

  const listeningCount = Math.max(
    1,
    typeof rawCount === "number" && !Number.isInteger(rawCount)
      ? Number(rawCount.toFixed(1))
      : Math.round(Number(rawCount) || 1)
  );

  const maxRadiusRef = isGenre ? 15.0 : 14.0;
  const rawRatio =
    node?.listening_ratio ??
    node?.listeningRatio ??
    props?.listening_ratio ??
    props?.listeningRatio ??
    Math.min(1.0, Math.max(0.05, radius / maxRadiusRef));

  const listeningRatio = Math.min(1.0, Math.max(0.01, Number(rawRatio) || 0.5));

  const listeningRank =
    node?.listening_rank ??
    node?.listeningRank ??
    props?.listening_rank ??
    props?.listeningRank ??
    node?.affinity_rank ??
    null;

  return {
    listeningCount,
    listeningRatio,
    listeningRank,
    diameter,
    radius,
    observedPlays,
    listeningMetricType,
    listeningMetricLabel,
  };
}

/**
 * Generates a clean satin node surface texture (retained for import/test compatibility,
 * free of planetary latitude bands).
 *
 * @param {string} colorHex
 * @param {string} name
 * @param {Object|null} resourceRegistry
 * @returns {THREE.Texture}
 */
export function createProceduralPlanetTexture(
  colorHex,
  name = "",
  resourceRegistry = null
) {
  void name;
  const validColor = sanitizeNodeColor(colorHex);
  let texture = null;

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(48, 42, 8, 64, 64, 64);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.28, validColor);
      grad.addColorStop(1, "#090d16");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  } else {
    texture = new THREE.DataTexture(new Uint8Array([29, 185, 84, 255]), 1, 1);
    texture.needsUpdate = true;
  }

  if (texture && resourceRegistry?.textures) {
    resourceRegistry.textures.add(texture);
  }
  return texture;
}

/**
 * Creates a crisp, high-contrast Graphify label canvas with node name and listening count/ratio.
 *
 * @param {string} name
 * @param {string} colorHex
 * @param {string} subtitleText
 * @returns {HTMLCanvasElement|null}
 */
function createGraphifyLabelCanvas(name, colorHex, subtitleText = "") {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, 320, 80);

  const validColor = sanitizeNodeColor(colorHex);
  const cleanName = sanitizeNodeName(name);

  const rx = 8;
  const ry = 8;
  const rw = 304;
  const rh = 64;
  const cornerRadius = 12;

  ctx.beginPath();
  ctx.moveTo(rx + cornerRadius, ry);
  ctx.lineTo(rx + rw - cornerRadius, ry);
  ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + cornerRadius);
  ctx.lineTo(rx + rw, ry + rh - cornerRadius);
  ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - cornerRadius, ry + rh);
  ctx.lineTo(rx + cornerRadius, ry + rh);
  ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - cornerRadius);
  ctx.lineTo(rx, ry + cornerRadius);
  ctx.quadraticCurveTo(rx, ry, rx + cornerRadius, ry);
  ctx.closePath();

  ctx.fillStyle = "rgba(9, 13, 22, 0.88)";
  ctx.fill();
  ctx.strokeStyle = validColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  const displayTitle =
    cleanName.length > 22 ? `${cleanName.slice(0, 20)}…` : cleanName;

  ctx.fillStyle = "#f8fafc";
  ctx.font =
    "700 20px Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(displayTitle, 160, subtitleText ? 30 : 40);

  if (subtitleText) {
    ctx.fillStyle = "#94a3b8";
    ctx.font =
      "600 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.fillText(subtitleText, 160, 54);
  }

  return canvas;
}

/**
 * Creates a readable Three.js Sprite label for a 3D knowledge graph node,
 * displaying node name and listening count/ratio.
 *
 * @param {Object} node
 * @param {Object} visualProps
 * @param {Object|null} resourceRegistry
 * @returns {THREE.Sprite}
 */
export function createNodeLabelSprite(
  node = {},
  visualProps = {},
  resourceRegistry = null
) {
  const safeName = sanitizeNodeName(node?.name || visualProps?.name);
  const nodeColor = sanitizeNodeColor(visualProps?.color || node?.color);
  const isGenre =
    node?.node_type === "genre" ||
    visualProps?.nodeType === "genre" ||
    visualProps?.geometryType === "star_core";

  const metrics = resolveNodeListeningMetrics(node, visualProps);
  const pctText = `${Math.round(metrics.listeningRatio * 100)}%`;

  const explicitType =
    node?.listening_metric_type ||
    visualProps?.listening_metric_type ||
    visualProps?.listeningMetricType;

  const subtitle =
    explicitType === "estimated_listening_index"
      ? `${metrics.listeningCount} pts (índice) · ${pctText}`
      : explicitType === "observed_plays" || (metrics.observedPlays !== null && metrics.observedPlays > 0)
      ? `${metrics.listeningCount} reproduções · ${pctText}`
      : `${metrics.listeningCount} escutas · ${pctText}`;

  const labelMat = new THREE.SpriteMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });

  if (resourceRegistry?.materials) {
    resourceRegistry.materials.add(labelMat);
  }

  if (typeof document !== "undefined") {
    const labelCanvas = createGraphifyLabelCanvas(
      isGenre ? `#${safeName}` : safeName,
      nodeColor,
      subtitle
    );
    if (labelCanvas) {
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      if (resourceRegistry?.textures) {
        resourceRegistry.textures.add(labelTex);
      }
      labelMat.map = labelTex;
    }
  }

  const labelSprite = new THREE.Sprite(labelMat);
  if (resourceRegistry?.sprites) {
    resourceRegistry.sprites.add(labelSprite);
  }

  const radius = metrics.radius;
  labelSprite.position.set(0, radius + 3.4, 0);
  labelSprite.scale.set(17, 4.25, 1);
  labelSprite.userData = {
    isLabelSprite: true,
    subtitle,
    listeningCount: metrics.listeningCount,
    listeningRatio: metrics.listeningRatio,
    observedPlays: metrics.observedPlays,
    listeningMetricType: metrics.listeningMetricType,
    listeningMetricLabel: metrics.listeningMetricLabel,
  };

  return labelSprite;
}

/**
 * Creates a Graphify-style 3D Knowledge Graph node object.
 * - Artists: clean 3D sphere (THREE.SphereGeometry) with high-contrast satin finish in cluster color
 *   and exact radius = props.radius (R_i = D_i / 2 = R_max * (L_i / L_max)).
 * - Genres: clean faceted 3D polyhedron (THREE.OctahedronGeometry) with exact radius = props.radius.
 * - Invisible raycast hit-sphere (hitRadius = Math.max(radius, 4.5), opacity: 0, transparent: true)
 *   for effortless hover/click on low-listening nodes without altering visible proportion.
 * - Readable label sprite with name and listening count/proportion.
 *
 * @param {Object} node Graph node data
 * @param {Object|null} visualProps Precomputed visual properties or null
 * @param {Object} options Configuration options (metadata, graphMode, links)
 * @param {Object|null} resourceRegistry Optional resource tracker
 * @returns {THREE.Group}
 */
export function createPlanetObject3D(
  node = {},
  visualProps = null,
  options = {},
  resourceRegistry = null
) {
  const finalVisualProps =
    visualProps ||
    computePlanetVisualProps(
      node,
      options.metadata,
      options.graphMode,
      options.links
    );

  const group = new THREE.Group();
  const safeName = sanitizeNodeName(node?.name);
  const escapedName = escapeHtml(safeName);

  const trackGeometry = (geo) => {
    if (geo && resourceRegistry?.geometries) {
      resourceRegistry.geometries.add(geo);
    }
    return geo;
  };

  const trackMaterial = (mat) => {
    if (mat && resourceRegistry?.materials) {
      resourceRegistry.materials.add(mat);
    }
    return mat;
  };

  const nodeColor = sanitizeNodeColor(finalVisualProps.color || node?.color);
  const isGenre =
    node?.node_type === "genre" ||
    finalVisualProps.nodeType === "genre" ||
    finalVisualProps.geometryType === "star_core" ||
    finalVisualProps.geometryType === "genre_polyhedron";

  const radius =
    Number.isFinite(finalVisualProps.radius) && finalVisualProps.radius > 0
      ? Number(finalVisualProps.radius)
      : isGenre
      ? 7.5
      : 5.0;

  const metrics = resolveNodeListeningMetrics(node, {
    ...finalVisualProps,
    radius,
  });

  group.userData = {
    nodeId: node?.id,
    nodeType: isGenre ? "genre" : "artist",
    visualProps: {
      ...finalVisualProps,
      radius,
      diameter: metrics.diameter,
      listening_count: metrics.listeningCount,
      listening_ratio: metrics.listeningRatio,
      listening_rank: metrics.listeningRank,
      observed_plays: metrics.observedPlays,
      listening_metric_type: metrics.listeningMetricType,
      listening_metric_label: metrics.listeningMetricLabel,
    },
    node,
    escapedName,
  };

  // 1. Primary Graphify 3D Node Mesh (exact proportional radius)
  if (isGenre) {
    const genreGeo = trackGeometry(new THREE.OctahedronGeometry(radius, 1));
    const genreMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: nodeColor,
        emissive: nodeColor,
        emissiveIntensity: 0.32,
        roughness: 0.25,
        metalness: 0.2,
        flatShading: true,
      })
    );
    const genreMesh = new THREE.Mesh(genreGeo, genreMat);
    genreMesh.userData = {
      isPrimaryNodeMesh: true,
      geometryKind: "polyhedron",
      radius,
    };
    group.add(genreMesh);
  } else {
    const artistGeo = trackGeometry(new THREE.SphereGeometry(radius, 28, 28));
    const artistMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: nodeColor,
        emissive: nodeColor,
        emissiveIntensity: 0.2,
        roughness: 0.34,
        metalness: 0.15,
      })
    );
    const artistMesh = new THREE.Mesh(artistGeo, artistMat);
    artistMesh.userData = {
      isPrimaryNodeMesh: true,
      geometryKind: "sphere",
      radius,
    };
    group.add(artistMesh);
  }

  // 2. Invisible Raycast Hit-Sphere (hitRadius = Math.max(radius, 4.5))
  // Guarantees small nodes remain easy to hover/click without distorting visible proportion
  const hitRadius = Math.max(radius, 4.5);
  const hitGeo = trackGeometry(new THREE.SphereGeometry(hitRadius, 12, 12));
  const hitMat = trackMaterial(
    new THREE.MeshBasicMaterial({
      color: nodeColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.userData = {
    isHitSphere: true,
    hitRadius,
    visibleRadius: radius,
  };
  group.add(hitMesh);

  // 3. Readable Graphify Label Sprite
  const labelSprite = createNodeLabelSprite(
    node,
    { ...finalVisualProps, radius },
    resourceRegistry
  );
  group.userData.labelSprite = labelSprite;
  group.add(labelSprite);

  return group;
}

export const createPlanetObject = createPlanetObject3D;

/**
 * Returns a clean empty THREE.Group without decorative star particles
 * (retained for import/test compatibility).
 *
 * @param {number} starCount
 * @param {number} radius
 * @param {Object|null} resourceRegistry
 * @returns {THREE.Group}
 */
export function createCosmicStarfield(
  starCount = 0,
  radius = 1400,
  resourceRegistry = null
) {
  void starCount;
  void resourceRegistry;
  const cleanGroup = new THREE.Group();
  cleanGroup.userData = {
    starCount: 0,
    radius: Number.isFinite(radius) && radius > 0 ? radius : 1400,
    isCleanGraphifyStage: true,
  };
  return cleanGroup;
}

export const createStarfield = createCosmicStarfield;

/**
 * Safely configures 3D physics forces on ForceGraph3D instance, adding cluster gravity.
 *
 * @param {Object} fgInstance ForceGraph3D instance
 * @param {Object} options Configuration options
 */
export function configureSpaceForces3D(
  fgInstance,
  { graphMode = "artists", clusterCentroids = new Map(), nodes = [] } = {}
) {
  if (!fgInstance || typeof fgInstance.d3Force !== "function") {
    return;
  }

  // 1. Configure charge force
  const charge = fgInstance.d3Force("charge");
  if (charge && typeof charge.strength === "function") {
    const chargeStrength = graphMode === "bipartite" ? -120 : -95;
    charge.strength(chargeStrength);
    if (typeof charge.distanceMax === "function") {
      charge.distanceMax(600);
    }
  }

  // 2. Configure link force
  const link = fgInstance.d3Force("link");
  if (link && typeof link.distance === "function") {
    link.distance((l) => {
      const weight = Number.isFinite(l?.weight) ? l.weight : 0.2;
      return Math.max(32, 160 * (1 - Math.min(1, weight * 0.8)));
    });
  }

  // 3. Custom cluster gravity force
  let simNodes = Array.isArray(nodes) ? nodes : [];

  function clusterGravity(alpha) {
    if (!clusterCentroids) return;
    const effectiveAlpha = typeof alpha === "number" ? alpha : 0.1;
    const strength = effectiveAlpha * 0.08;
    const targetNodes =
      simNodes.length > 0 ? simNodes : Array.isArray(nodes) ? nodes : [];

    for (let i = 0; i < targetNodes.length; i++) {
      const node = targetNodes[i];
      if (!node || node.cluster_id === undefined || node.cluster_id === null) {
        continue;
      }

      const centroid =
        typeof clusterCentroids.get === "function"
          ? clusterCentroids.get(node.cluster_id)
          : clusterCentroids[node.cluster_id];

      if (!centroid) continue;

      const cx = Number.isFinite(centroid.x)
        ? centroid.x
        : Array.isArray(centroid)
        ? centroid[0]
        : 0;
      const cy = Number.isFinite(centroid.y)
        ? centroid.y
        : Array.isArray(centroid)
        ? centroid[1]
        : 0;
      const cz = Number.isFinite(centroid.z)
        ? centroid.z
        : Array.isArray(centroid)
        ? centroid[2]
        : 0;

      if (Number.isFinite(node.vx) && Number.isFinite(node.x)) {
        node.vx += (cx - node.x) * strength;
      } else if (Number.isFinite(node.x)) {
        node.x += (cx - node.x) * strength * 0.1;
      }

      if (Number.isFinite(node.vy) && Number.isFinite(node.y)) {
        node.vy += (cy - node.y) * strength;
      } else if (Number.isFinite(node.y)) {
        node.y += (cy - node.y) * strength * 0.1;
      }

      if (Number.isFinite(node.vz) && Number.isFinite(node.z)) {
        node.vz += (cz - node.z) * strength;
      } else if (Number.isFinite(node.z)) {
        node.z += (cz - node.z) * strength * 0.1;
      }
    }
  }

  clusterGravity.initialize = function (n) {
    simNodes = n;
  };

  fgInstance.d3Force("cluster_gravity", clusterGravity);
}

/**
 * Attaches webglcontextlost and webglcontextrestored listeners to a canvas element.
 * Supports both { onContextLost, onContextRestored } object or positional callbacks.
 *
 * @param {HTMLCanvasElement} canvasElement
 * @param {Object|Function} handlersOrOnLost Callbacks object or onContextLost function
 * @param {Function|null} maybeOnRestored onContextRestored function if positional
 * @returns {Function} detach function removing both listeners
 */
export function attachWebGLContextListeners(
  canvasElement,
  handlersOrOnLost = {},
  maybeOnRestored = null
) {
  if (!canvasElement || typeof canvasElement.addEventListener !== "function") {
    return function detach() {};
  }

  let onContextLost = null;
  let onContextRestored = null;

  if (typeof handlersOrOnLost === "function") {
    onContextLost = handlersOrOnLost;
    onContextRestored = maybeOnRestored;
  } else if (handlersOrOnLost && typeof handlersOrOnLost === "object") {
    onContextLost = handlersOrOnLost.onContextLost;
    onContextRestored = handlersOrOnLost.onContextRestored;
  }

  const handleContextLost = (event) => {
    if (typeof event?.preventDefault === "function") {
      event.preventDefault();
    }
    if (typeof onContextLost === "function") {
      onContextLost(event);
    }
  };

  const handleContextRestored = (event) => {
    if (typeof onContextRestored === "function") {
      onContextRestored(event);
    }
  };

  canvasElement.addEventListener("webglcontextlost", handleContextLost, false);
  canvasElement.addEventListener(
    "webglcontextrestored",
    handleContextRestored,
    false
  );

  return function detach() {
    if (typeof canvasElement.removeEventListener === "function") {
      canvasElement.removeEventListener(
        "webglcontextlost",
        handleContextLost,
        false
      );
      canvasElement.removeEventListener(
        "webglcontextrestored",
        handleContextRestored,
        false
      );
    }
  };
}

/**
 * Deterministically traverses and disposes Three.js resources (geometries, materials, textures, sprites).
 *
 * @param {THREE.Object3D|THREE.Scene|THREE.Group|null} sceneOrRoot
 * @param {Object|null} resourceRegistry
 * @returns {{ disposedGeometries: number, disposedMaterials: number, disposedTextures: number, disposedSprites: number }}
 */
export function disposeThreeUniverse(
  sceneOrRoot = null,
  resourceRegistry = null
) {
  let disposedGeometries = 0;
  let disposedMaterials = 0;
  let disposedTextures = 0;
  let disposedSprites = 0;

  const geometriesToDispose = new Set(resourceRegistry?.geometries || []);
  const materialsToDispose = new Set(resourceRegistry?.materials || []);
  const texturesToDispose = new Set(resourceRegistry?.textures || []);
  const spritesToDispose = new Set(resourceRegistry?.sprites || []);

  if (sceneOrRoot && typeof sceneOrRoot.traverse === "function") {
    sceneOrRoot.traverse((obj) => {
      if (!obj) return;

      if (obj.isSprite || obj instanceof THREE.Sprite) {
        spritesToDispose.add(obj);
      }

      if (obj.geometry) {
        geometriesToDispose.add(obj.geometry);
      }

      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => {
            if (mat) {
              materialsToDispose.add(mat);
              if (mat.map) texturesToDispose.add(mat.map);
              if (mat.emissiveMap) texturesToDispose.add(mat.emissiveMap);
              if (mat.alphaMap) texturesToDispose.add(mat.alphaMap);
            }
          });
        } else {
          materialsToDispose.add(obj.material);
          if (obj.material.map) texturesToDispose.add(obj.material.map);
          if (obj.material.emissiveMap) {
            texturesToDispose.add(obj.material.emissiveMap);
          }
          if (obj.material.alphaMap) {
            texturesToDispose.add(obj.material.alphaMap);
          }
        }
      }
    });
  }

  materialsToDispose.forEach((mat) => {
    if (mat && typeof mat === "object") {
      if (mat.map) texturesToDispose.add(mat.map);
      if (mat.emissiveMap) texturesToDispose.add(mat.emissiveMap);
      if (mat.alphaMap) texturesToDispose.add(mat.alphaMap);
    }
  });

  texturesToDispose.forEach((tex) => {
    if (tex && typeof tex.dispose === "function") {
      try {
        tex.dispose();
      } catch {
        // Safe disposal
      }
      disposedTextures++;
    }
  });

  materialsToDispose.forEach((mat) => {
    if (mat && typeof mat.dispose === "function") {
      try {
        mat.dispose();
      } catch {
        // Safe disposal
      }
      disposedMaterials++;
    }
  });

  geometriesToDispose.forEach((geo) => {
    if (geo && typeof geo.dispose === "function") {
      try {
        geo.dispose();
      } catch {
        // Safe disposal
      }
      disposedGeometries++;
    }
  });

  spritesToDispose.forEach((spr) => {
    if (spr && typeof spr.dispose === "function") {
      try {
        spr.dispose();
      } catch {
        // Safe disposal
      }
    }
    if (spr?.parent && typeof spr.parent.remove === "function") {
      try {
        spr.parent.remove(spr);
      } catch {
        // Safe detach
      }
    }
    disposedSprites++;
  });

  if (resourceRegistry) {
    if (resourceRegistry.geometries instanceof Set) {
      resourceRegistry.geometries.clear();
    }
    if (resourceRegistry.materials instanceof Set) {
      resourceRegistry.materials.clear();
    }
    if (resourceRegistry.textures instanceof Set) {
      resourceRegistry.textures.clear();
    }
    if (resourceRegistry.sprites instanceof Set) {
      resourceRegistry.sprites.clear();
    }
  }

  if (sceneOrRoot && typeof sceneOrRoot.remove === "function") {
    while (sceneOrRoot.children && sceneOrRoot.children.length > 0) {
      sceneOrRoot.remove(sceneOrRoot.children[0]);
    }
  }

  return {
    disposedGeometries,
    disposedMaterials,
    disposedTextures,
    disposedSprites,
  };
}
