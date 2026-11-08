// The backend owns the formula. These coefficients only explain its published components.
export const ARTIST_EDGE_COEFFICIENTS = Object.freeze({
  genre_similarity: 0.65,
  direct_collaboration: 0.25,
  co_listening: 0.10,
});

export function endpointId(endpoint) {
  return typeof endpoint === "object" && endpoint !== null ? endpoint.id : endpoint;
}

export function connectionKey(link) {
  return [String(endpointId(link.source)), String(endpointId(link.target))].sort().join("\u0000");
}

export function explainConnection(link, nodesById, graphMode) {
  if (!link) return null;

  const source = nodesById.get(endpointId(link.source));
  const target = nodesById.get(endpointId(link.target));
  if (!source || !target || !Number.isFinite(link.weight)) return null;

  if (graphMode === "bipartite") {
    const artist = source.node_type === "artist" ? source : target;
    const genre = source.node_type === "genre" ? source : target;
    if (artist.node_type !== "artist" || genre.node_type !== "genre") return null;
    return {
      kind: "artist-genre",
      artistName: artist.name,
      genreName: genre.name,
      weight: link.weight,
    };
  }

  const components = Object.entries(ARTIST_EDGE_COEFFICIENTS).map(([name, coefficient]) => {
    const reported = link.components?.[name];
    return {
      name,
      coefficient,
      reported: Number.isFinite(reported) ? reported : null,
      contribution: Number.isFinite(reported) ? coefficient * reported : null,
    };
  });

  return {
    kind: "artist-artist",
    sourceName: source.name,
    targetName: target.name,
    weight: link.weight,
    components,
    sharedGenres: Array.isArray(link.shared_genres) ? link.shared_genres : [],
  };
}
