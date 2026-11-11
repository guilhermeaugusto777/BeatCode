/**
 * @file spacePreferences.js
 * Gerenciador seguro de preferências locais para o BeatCode Space.
 *
 * Responsável pela persistência defensiva em localStorage com:
 * - Validação e sanitização estrita baseada em whitelist (Invariante Zero-Secret)
 * - Limitação de taxa/tamanho (FIFO para histórico de planetas visitados, máx 10)
 * - Clamping rígido de parâmetros numéricos (min_edge_weight em [0.05, 0.65])
 * - Resiliência e fallback em memória caso localStorage esteja indisponível ou lance exceção
 */

export const SPACE_PREFS_STORAGE_KEY = "beatcode_space_prefs_v1";

/**
 * Preferências padrão do BeatCode Space.
 */
export const DEFAULT_SPACE_PREFERENCES = Object.freeze({
  version: 1,
  view_mode: "space_3d",
  graph_mode: "artists",
  time_range: "medium_term",
  min_edge_weight: 0.15,
  node_type_filter: "all",
  visible_node_types: Object.freeze(["artist", "genre"]),
  hidden_clusters: Object.freeze([]),
  visual_effects: Object.freeze({
    starfield: true,
    orbital_rings: true,
    reduced_motion: false,
  }),
  recent_planets: Object.freeze([]),
});

/**
 * Fallback em memória para ambientes onde window.localStorage é bloqueado ou inacessível.
 */
const memoryStorage = new Map();

/**
 * Cria cópia profunda desacoplada de um objeto de preferências.
 * @param {typeof DEFAULT_SPACE_PREFERENCES} prefs
 */
function clonePreferences(prefs) {
  return {
    version: prefs.version ?? 1,
    view_mode: prefs.view_mode ?? "space_3d",
    graph_mode: prefs.graph_mode ?? "artists",
    time_range: prefs.time_range ?? "medium_term",
    min_edge_weight: prefs.min_edge_weight ?? 0.15,
    node_type_filter: prefs.node_type_filter ?? "all",
    visible_node_types: Array.isArray(prefs.visible_node_types)
      ? [...prefs.visible_node_types]
      : ["artist", "genre"],
    hidden_clusters: Array.isArray(prefs.hidden_clusters)
      ? [...prefs.hidden_clusters]
      : [],
    visual_effects: {
      starfield: prefs.visual_effects?.starfield ?? true,
      orbital_rings: prefs.visual_effects?.orbital_rings ?? true,
      reduced_motion: prefs.visual_effects?.reduced_motion ?? false,
    },
    recent_planets: Array.isArray(prefs.recent_planets)
      ? prefs.recent_planets.map((p) => ({ ...p }))
      : [],
  };
}

/**
 * Resolve o objeto de armazenamento efetivo (armazenamento injetado, window.localStorage ou fallback em memória).
 * @param {Storage | { getItem: Function, setItem: Function, removeItem: Function } | null | undefined} storage
 */
function getEffectiveStorage(storage) {
  if (storage && typeof storage.getItem === "function") {
    return storage;
  }
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage) {
        return window.localStorage;
      }
    } catch {
      // Bloqueio de storage (ex.: SecurityError / private mode)
    }
  }
  return {
    getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
    setItem: (key, val) => {
      memoryStorage.set(key, String(val));
    },
    removeItem: (key) => {
      memoryStorage.delete(key);
    },
    clear: () => {
      memoryStorage.clear();
    },
  };
}

/**
 * Leitura protegida contra SecurityError e ausência de storage.
 */
function safeGetItem(storage, key) {
  try {
    if (storage && typeof storage.getItem === "function") {
      const value = storage.getItem(key);
      if (value !== null && value !== undefined) {
        return value;
      }
    }
  } catch {
    // Ignora erro e recorre ao fallback em memória
  }
  return memoryStorage.has(key) ? memoryStorage.get(key) : null;
}

/**
 * Gravação protegida contra QuotaExceededError e SecurityError.
 */
function safeSetItem(storage, key, value) {
  const stringVal = String(value);
  try {
    if (storage && typeof storage.setItem === "function") {
      storage.setItem(key, stringVal);
    }
  } catch {
    // Fallback silencioso em memória
  }
  memoryStorage.set(key, stringVal);
}

/**
 * Remoção protegida de chave do storage.
 */
function safeRemoveItem(storage, key) {
  try {
    if (storage && typeof storage.removeItem === "function") {
      storage.removeItem(key);
    }
  } catch {
    // Ignora erro
  }
  memoryStorage.delete(key);
}

/**
 * Sanitiza e valida estritamente um objeto bruto de preferências.
 * Aplica whitelist rigorosa descartando qualquer chave sensível ou estranha (Zero-Secret).
 *
 * @param {unknown} raw Objeto de preferências a ser sanitizado
 * @returns {typeof DEFAULT_SPACE_PREFERENCES} Objeto validado e seguro
 */
export function sanitizeSpacePreferences(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return clonePreferences(DEFAULT_SPACE_PREFERENCES);
  }

  // 1. view_mode
  const viewMode =
    raw.view_mode === "space_3d" || raw.view_mode === "map_2d"
      ? raw.view_mode
      : DEFAULT_SPACE_PREFERENCES.view_mode;

  // 2. graph_mode
  const graphMode =
    raw.graph_mode === "artists" || raw.graph_mode === "bipartite"
      ? raw.graph_mode
      : DEFAULT_SPACE_PREFERENCES.graph_mode;

  // 3. time_range
  const timeRange =
    raw.time_range === "short_term" ||
    raw.time_range === "medium_term" ||
    raw.time_range === "long_term"
      ? raw.time_range
      : DEFAULT_SPACE_PREFERENCES.time_range;

  // 4. min_edge_weight: clamp estrito em [0.05, 0.65]
  let minEdgeWeight = Number(raw.min_edge_weight);
  if (!Number.isFinite(minEdgeWeight)) {
    minEdgeWeight = DEFAULT_SPACE_PREFERENCES.min_edge_weight;
  } else {
    minEdgeWeight = Math.min(0.65, Math.max(0.05, minEdgeWeight));
    minEdgeWeight = Math.round(minEdgeWeight * 10000) / 10000;
  }

  // 5. node_type_filter
  const nodeTypeFilter =
    raw.node_type_filter === "all" ||
    raw.node_type_filter === "artist" ||
    raw.node_type_filter === "genre"
      ? raw.node_type_filter
      : DEFAULT_SPACE_PREFERENCES.node_type_filter;

  // 6. visible_node_types: subconjunto único de ["artist", "genre"]
  let visibleNodeTypes = [];
  if (Array.isArray(raw.visible_node_types)) {
    const seen = new Set();
    for (const item of raw.visible_node_types) {
      if ((item === "artist" || item === "genre") && !seen.has(item)) {
        seen.add(item);
        visibleNodeTypes.push(item);
      }
    }
    if (visibleNodeTypes.length === 0) {
      visibleNodeTypes = [...DEFAULT_SPACE_PREFERENCES.visible_node_types];
    }
  } else {
    visibleNodeTypes = [...DEFAULT_SPACE_PREFERENCES.visible_node_types];
  }

  // 7. hidden_clusters: array de inteiros únicos >= 0
  let hiddenClusters = [];
  if (Array.isArray(raw.hidden_clusters)) {
    const clusterSet = new Set();
    for (const item of raw.hidden_clusters) {
      const num = typeof item === "number" ? item : Number(item);
      if (Number.isInteger(num) && num >= 0) {
        clusterSet.add(num);
      }
    }
    hiddenClusters = Array.from(clusterSet).sort((a, b) => a - b);
  }

  // 8. visual_effects: whitelist { starfield, orbital_rings, reduced_motion }
  const rawEffects =
    raw.visual_effects &&
    typeof raw.visual_effects === "object" &&
    !Array.isArray(raw.visual_effects)
      ? raw.visual_effects
      : {};

  const visualEffects = {
    starfield:
      typeof rawEffects.starfield === "boolean"
        ? rawEffects.starfield
        : DEFAULT_SPACE_PREFERENCES.visual_effects.starfield,
    orbital_rings:
      typeof rawEffects.orbital_rings === "boolean"
        ? rawEffects.orbital_rings
        : DEFAULT_SPACE_PREFERENCES.visual_effects.orbital_rings,
    reduced_motion:
      typeof rawEffects.reduced_motion === "boolean"
        ? rawEffects.reduced_motion
        : DEFAULT_SPACE_PREFERENCES.visual_effects.reduced_motion,
  };

  // 9. recent_planets: FIFO máx 10 itens sem duplicatas por id
  let recentPlanets = [];
  if (Array.isArray(raw.recent_planets)) {
    const seenIds = new Set();
    for (const item of raw.recent_planets) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const id =
        typeof item.id === "string" || typeof item.id === "number"
          ? String(item.id).trim()
          : "";
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const name =
        typeof item.name === "string" && item.name.trim().length > 0
          ? item.name.trim().slice(0, 120)
          : id;
      const nodeType =
        item.node_type === "genre" || item.type === "genre"
          ? "genre"
          : "artist";
      const visitedAt =
        typeof item.visited_at === "number" &&
        Number.isFinite(item.visited_at) &&
        item.visited_at > 0
          ? Math.floor(item.visited_at)
          : Date.now();

      recentPlanets.push({
        id,
        name,
        node_type: nodeType,
        visited_at: visitedAt,
      });

      if (recentPlanets.length >= 10) break;
    }
  }

  return {
    version: 1,
    view_mode: viewMode,
    graph_mode: graphMode,
    time_range: timeRange,
    min_edge_weight: minEdgeWeight,
    node_type_filter: nodeTypeFilter,
    visible_node_types: visibleNodeTypes,
    hidden_clusters: hiddenClusters,
    visual_effects: visualEffects,
    recent_planets: recentPlanets,
  };
}

/**
 * Carrega as preferências do storage com validação e fallback seguro.
 *
 * @param {Storage | Object | null | undefined} storage Storage opcional injetável
 * @returns {typeof DEFAULT_SPACE_PREFERENCES} Preferências válidas
 */
export function loadSpacePreferences(storage) {
  const effectiveStorage = getEffectiveStorage(storage);
  const rawString = safeGetItem(effectiveStorage, SPACE_PREFS_STORAGE_KEY);
  if (!rawString) {
    return clonePreferences(DEFAULT_SPACE_PREFERENCES);
  }
  try {
    const parsed = JSON.parse(rawString);
    return sanitizeSpacePreferences(parsed);
  } catch {
    return clonePreferences(DEFAULT_SPACE_PREFERENCES);
  }
}

/**
 * Salva preferências parciais no storage, aplicando sanitização e mesclagem defensiva.
 *
 * @param {Partial<typeof DEFAULT_SPACE_PREFERENCES>} partialPrefs Atualizações parciais
 * @param {Storage | Object | null | undefined} storage Storage opcional injetável
 * @returns {typeof DEFAULT_SPACE_PREFERENCES} Preferências atualizadas e persistidas
 */
export function saveSpacePreferences(partialPrefs, storage) {
  const current = loadSpacePreferences(storage);
  const patch =
    partialPrefs && typeof partialPrefs === "object" && !Array.isArray(partialPrefs)
      ? partialPrefs
      : {};

  const merged = {
    ...current,
    ...patch,
  };

  if (patch.visual_effects && typeof patch.visual_effects === "object") {
    merged.visual_effects = {
      ...current.visual_effects,
      ...patch.visual_effects,
    };
  }

  const sanitized = sanitizeSpacePreferences(merged);
  const effectiveStorage = getEffectiveStorage(storage);
  safeSetItem(effectiveStorage, SPACE_PREFS_STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

/**
 * Registra a visita a um planeta/nó na fila FIFO recente (máx 10 itens, sem duplicatas por id).
 *
 * @param {{ id: string, name?: string, node_type?: string, type?: string, visited_at?: number }} node
 * @param {typeof DEFAULT_SPACE_PREFERENCES | null | undefined} currentPrefs Preferências atuais opcionais
 * @param {Storage | Object | null | undefined} storage Storage opcional injetável
 * @returns {typeof DEFAULT_SPACE_PREFERENCES} Preferências com histórico atualizado
 */
export function recordVisitedPlanet(node, currentPrefs, storage) {
  const basePrefs = currentPrefs
    ? sanitizeSpacePreferences(currentPrefs)
    : loadSpacePreferences(storage);

  if (!node || typeof node !== "object") {
    return basePrefs;
  }

  const id =
    typeof node.id === "string" || typeof node.id === "number"
      ? String(node.id).trim()
      : "";
  if (!id) {
    return basePrefs;
  }

  const name =
    typeof node.name === "string" && node.name.trim().length > 0
      ? node.name.trim().slice(0, 120)
      : id;
  const nodeType =
    node.node_type === "genre" || node.type === "genre" ? "genre" : "artist";
  const visitedAt =
    typeof node.visited_at === "number" &&
    Number.isFinite(node.visited_at) &&
    node.visited_at > 0
      ? Math.floor(node.visited_at)
      : Date.now();

  const newEntry = {
    id,
    name,
    node_type: nodeType,
    visited_at: visitedAt,
  };

  const filtered = basePrefs.recent_planets.filter((p) => p && p.id !== id);
  const updatedPlanets = [newEntry, ...filtered].slice(0, 10);

  return saveSpacePreferences(
    { ...basePrefs, recent_planets: updatedPlanets },
    storage
  );
}

/**
 * Reseta as preferências locais para o padrão original, limpando o storage.
 *
 * @param {Storage | Object | null | undefined} storage Storage opcional injetável
 * @returns {typeof DEFAULT_SPACE_PREFERENCES} Preferências resetadas para o padrão
 */
export function resetSpacePreferences(storage) {
  const effectiveStorage = getEffectiveStorage(storage);
  safeRemoveItem(effectiveStorage, SPACE_PREFS_STORAGE_KEY);
  return clonePreferences(DEFAULT_SPACE_PREFERENCES);
}
