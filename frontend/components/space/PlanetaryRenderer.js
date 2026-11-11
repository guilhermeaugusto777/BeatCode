/**
 * PlanetaryRenderer.js — Three.js 3D Cosmic Space Renderer & GPU Lifecycle Guard
 *
 * Implements procedural planetary spheres with equatorial bands, Spotify photo textures,
 * atmospheric Fresnel halos, tilted orbital rings, octahedron genre stellar cores,
 * crisp LOD label sprites, cosmic starfield, 3D cluster forces, WebGL context guard,
 * and deterministic GPU resource disposal.
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
 * Procedurally generates an equatorial banded canvas texture for a planet.
 *
 * @param {string} colorHex
 * @param {string} name
 * @returns {HTMLCanvasElement|null}
 */
function createProceduralPlanetCanvas(colorHex, name) {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const validColor = sanitizeNodeColor(colorHex);

  // Deep space base gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
  bgGrad.addColorStop(0, validColor);
  bgGrad.addColorStop(0.5, "#0b1320");
  bgGrad.addColorStop(1, validColor);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 256);

  // Equatorial and temperate latitude bands
  const bandCount = 14;
  for (let i = 0; i < bandCount; i++) {
    const y = (256 / bandCount) * i;
    const h = 256 / bandCount;
    const alpha = 0.12 + 0.16 * Math.sin((i / bandCount) * Math.PI);
    ctx.fillStyle =
      i % 2 === 0
        ? `rgba(255, 255, 255, ${alpha.toFixed(3)})`
        : `rgba(0, 0, 0, ${alpha.toFixed(3)})`;

    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) {
      const wave = Math.sin((x / 512) * Math.PI * 4 + i) * 3;
      ctx.lineTo(x, y + wave);
    }
    ctx.lineTo(512, y + h);
    ctx.lineTo(0, y + h);
    ctx.closePath();
    ctx.fill();
  }

  // Subtle monogram mark on polar axis
  if (name && typeof name === "string") {
    const cleanName = sanitizeNodeName(name);
    const initial = cleanName.charAt(0).toUpperCase();
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial, 256, 128);
  }

  return canvas;
}

/**
 * Procedurally generates a crisp dark-glass pill label canvas for a planet or stellar core.
 *
 * @param {string} name
 * @param {string} colorHex
 * @returns {HTMLCanvasElement|null}
 */
function createProceduralLabelCanvas(name, colorHex) {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, 256, 64);

  const validColor = sanitizeNodeColor(colorHex);
  const cleanName = sanitizeNodeName(name);

  // Glassmorphic pill container
  const rx = 8;
  const ry = 8;
  const rw = 240;
  const rh = 48;
  const radius = 14;

  ctx.beginPath();
  ctx.moveTo(rx + radius, ry);
  ctx.lineTo(rx + rw - radius, ry);
  ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
  ctx.lineTo(rx + rw, ry + rh - radius);
  ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
  ctx.lineTo(rx + radius, ry + rh);
  ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
  ctx.lineTo(rx, ry + radius);
  ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
  ctx.closePath();

  ctx.fillStyle = "rgba(10, 15, 30, 0.78)";
  ctx.fill();
  ctx.strokeStyle = validColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label text with truncation
  ctx.fillStyle = "#ffffff";
  ctx.font =
    "600 20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const display = cleanName.length > 20 ? `${cleanName.slice(0, 18)}…` : cleanName;
  ctx.fillText(display, 128, 32);

  return canvas;
}

/**
 * Creates a Three.js 3D object for a celestial graph node (planet or genre stellar core).
 *
 * @param {Object} node Graph node data
 * @param {Object|null} visualProps Precomputed visual properties or null
 * @param {Object} options Configuration options (metadata, graphMode, links, orbitalRings)
 * @param {Object|null} resourceRegistry Optional resource tracker
 * @returns {THREE.Group} Group holding meshes, halos, rings, and label sprite
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

  group.userData = {
    nodeId: node?.id,
    visualProps: finalVisualProps,
    node,
    escapedName,
  };

  // Helper registration callbacks
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

  const trackTexture = (tex) => {
    if (tex && resourceRegistry?.textures) {
      resourceRegistry.textures.add(tex);
    }
    return tex;
  };

  const trackSprite = (spr) => {
    if (spr && resourceRegistry?.sprites) {
      resourceRegistry.sprites.add(spr);
    }
    return spr;
  };

  const nodeColor = sanitizeNodeColor(finalVisualProps.color);
  const isStarCore = finalVisualProps.geometryType === "star_core";

  if (isStarCore) {
    // 1. Emissive Polyhedral Stellar Core (Genre Hub in Bipartite Mode)
    const coreRadius = Number.isFinite(finalVisualProps.radius)
      ? finalVisualProps.radius
      : 8.0;
    const coreGeo = trackGeometry(new THREE.OctahedronGeometry(coreRadius, 1));
    const coreMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: nodeColor,
        emissive: nodeColor,
        emissiveIntensity: 0.75,
        roughness: 0.2,
        metalness: 0.3,
      })
    );
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);
  } else {
    // 2. Spherical Planetary Body (Artist Node)
    const planetRadius = Number.isFinite(finalVisualProps.radius)
      ? finalVisualProps.radius
      : 4.5;
    const planetGeo = trackGeometry(
      new THREE.SphereGeometry(planetRadius, 24, 24)
    );

    let planetTexture = null;

    if (typeof document !== "undefined") {
      // Browser environment: procedural canvas texture with fallback
      const canvas = createProceduralPlanetCanvas(nodeColor, safeName);
      if (canvas) {
        planetTexture = trackTexture(new THREE.CanvasTexture(canvas));
        planetTexture.wrapS = THREE.ClampToEdgeWrapping;
        planetTexture.wrapT = THREE.ClampToEdgeWrapping;
      }
    } else {
      // Node.js test environment (e.g., C11 memory disposal verification)
      planetTexture = trackTexture(
        new THREE.DataTexture(new Uint8Array([29, 185, 84, 255]), 1, 1)
      );
      planetTexture.needsUpdate = true;
    }

    const planetMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: nodeColor,
        map: planetTexture,
        roughness: 0.6,
        metalness: 0.15,
      })
    );

    // If Spotify image_url is available in browser, load it with automatic fallback
    if (typeof document !== "undefined" && node?.image_url) {
      try {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin("anonymous");
        loader.load(
          node.image_url,
          (loadedTexture) => {
            trackTexture(loadedTexture);
            planetMat.map = loadedTexture;
            planetMat.color.setHex(0xffffff);
            planetMat.needsUpdate = true;
          },
          undefined,
          () => {
            // Keep procedural canvas texture on error/CORS block
          }
        );
      } catch {
        // Safe fallback
      }
    }

    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    group.add(planetMesh);
  }

  // 3. Atmospheric Fresnel Halo
  const haloRadius = Number.isFinite(finalVisualProps.haloRadius)
    ? finalVisualProps.haloRadius
    : (finalVisualProps.radius || 4.5) * 1.3;
  const haloOpacity = Number.isFinite(finalVisualProps.haloOpacity)
    ? finalVisualProps.haloOpacity
    : 0.25;

  const haloGeo = trackGeometry(
    new THREE.SphereGeometry(haloRadius, 20, 20)
  );
  const haloMat = trackMaterial(
    new THREE.MeshBasicMaterial({
      color: nodeColor,
      transparent: true,
      opacity: haloOpacity,
      depthWrite: false,
      side: THREE.BackSide,
    })
  );
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  group.add(haloMesh);

  // 4. Orbital Ring (for Bridge Artists or High Inter-Cluster Diversity)
  const allowRings = options.orbitalRings !== false;
  if (finalVisualProps.hasOrbitalRing && allowRings) {
    const ringInner = Number.isFinite(finalVisualProps.ringInnerRadius)
      ? finalVisualProps.ringInnerRadius
      : (finalVisualProps.radius || 4.5) * 1.35;
    const ringOuter = Number.isFinite(finalVisualProps.ringOuterRadius)
      ? finalVisualProps.ringOuterRadius
      : (finalVisualProps.radius || 4.5) * 2.05;

    const ringGeo = trackGeometry(
      new THREE.RingGeometry(ringInner, ringOuter, 32)
    );
    const ringMat = trackMaterial(
      new THREE.MeshBasicMaterial({
        color: nodeColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      })
    );
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.set(
      finalVisualProps.ringTiltRad || 0,
      finalVisualProps.ringYawRad || 0,
      0
    );
    group.add(ringMesh);
  }

  // 5. Crisp LOD Label Sprite
  const labelMat = trackMaterial(
    new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
    })
  );

  if (typeof document !== "undefined") {
    const labelCanvas = createProceduralLabelCanvas(safeName, nodeColor);
    if (labelCanvas) {
      const labelTex = trackTexture(new THREE.CanvasTexture(labelCanvas));
      labelMat.map = labelTex;
    }
  }

  const labelSprite = trackSprite(new THREE.Sprite(labelMat));
  const labelY = (haloRadius || (finalVisualProps.radius || 4.5) * 1.3) + 3.5;
  labelSprite.position.set(0, labelY, 0);
  labelSprite.scale.set(16, 4, 1);

  group.userData.labelSprite = labelSprite;
  group.add(labelSprite);

  return group;
}

/**
 * Creates a deterministic cosmic starfield background using spherical Fibonacci / sinusoidal distribution.
 *
 * @param {number} starCount Number of background stars (default: 1200)
 * @param {number} radius Spherical radius envelope (default: 1400)
 * @param {Object|null} resourceRegistry Optional resource tracker
 * @returns {THREE.Points}
 */
export function createCosmicStarfield(
  starCount = 1200,
  radius = 1400,
  resourceRegistry = null
) {
  const count =
    Number.isFinite(starCount) && starCount > 0 ? Math.round(starCount) : 1200;
  const maxRadius =
    Number.isFinite(radius) && radius > 0 ? radius : 1400;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  // Deterministic golden spiral / Halton distribution on sphere with radial depth
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = 2 * Math.PI * i * goldenRatio;

    // Sinusoidal deterministic radial dispersion (no Math.random)
    const sinFactor = Math.abs(Math.sin((i + 1) * 12.9898));
    const r = maxRadius * (0.65 + 0.35 * sinFactor);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Subtle star colors (white-blue to warm stellar white)
    const colorMix = 0.8 + 0.2 * Math.cos(i * 3.1415);
    colors[i * 3] = colorMix;
    colors[i * 3 + 1] = colorMix;
    colors[i * 3 + 2] = 1.0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 2.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: false,
  });

  if (resourceRegistry) {
    if (resourceRegistry.geometries) resourceRegistry.geometries.add(geometry);
    if (resourceRegistry.materials) resourceRegistry.materials.add(material);
  }

  const points = new THREE.Points(geometry, material);
  points.userData = { starCount: count, radius: maxRadius };
  return points;
}

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
    const chargeStrength = graphMode === "bipartite" ? -120 : -90;
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
      return Math.max(30, 160 * (1 - Math.min(1, weight * 0.8)));
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
 * Deterministically traverses and disposes Three.js universe resources (geometries, materials, textures, sprites).
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

  // Also collect textures from materials in registry
  materialsToDispose.forEach((mat) => {
    if (mat && typeof mat === "object") {
      if (mat.map) texturesToDispose.add(mat.map);
      if (mat.emissiveMap) texturesToDispose.add(mat.emissiveMap);
      if (mat.alphaMap) texturesToDispose.add(mat.alphaMap);
    }
  });

  // 1. Dispose Textures
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

  // 2. Dispose Materials
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

  // 3. Dispose Geometries
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

  // 4. Detach and record Sprites
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

  // 5. Clear registry sets
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

  // 6. Clean children from scene or root container
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
