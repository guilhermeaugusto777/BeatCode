import assert from "node:assert/strict";
import test from "node:test";
import { ARTIST_EDGE_COEFFICIENTS, connectionKey, explainConnection } from "../lib/connectionExplanation.mjs";

const nodes = new Map([
  ["a", { id: "a", name: "Artista A", node_type: "artist" }],
  ["b", { id: "b", name: "Artista B", node_type: "artist" }],
  ["g", { id: "g", name: "r&b", node_type: "genre" }],
]);

test("explains weighted artist components without replacing the API weight", () => {
  const result = explainConnection({
    source: "a", target: "b", weight: 0.4081,
    components: { genre_similarity: 0.351, direct_collaboration: 0.5, co_listening: 0.55 },
    shared_genres: ["r&b"],
  }, nodes, "artists");

  assert.equal(result.kind, "artist-artist");
  assert.equal(result.sourceName, "Artista A");
  assert.equal(result.targetName, "Artista B");
  assert.equal(result.weight, 0.4081);
  assert.deepEqual(result.sharedGenres, ["r&b"]);
  assert.deepEqual(result.components.map(({ name, coefficient, contribution }) => [name, coefficient, contribution]), [
    ["genre_similarity", 0.65, 0.65 * 0.351],
    ["direct_collaboration", 0.25, 0.25 * 0.5],
    ["co_listening", 0.10, 0.10 * 0.55],
  ]);
  assert.notEqual(result.components.reduce((sum, item) => sum + item.contribution, 0), result.weight);
  assert.deepEqual(ARTIST_EDGE_COEFFICIENTS, { genre_similarity: 0.65, direct_collaboration: 0.25, co_listening: 0.10 });
});

test("uses the same stable key for link IDs and force-graph endpoint objects", () => {
  assert.equal(connectionKey({ source: "a", target: "b" }), connectionKey({ source: nodes.get("b"), target: nodes.get("a") }));
});

test("does not invent missing components", () => {
  const result = explainConnection({ source: "a", target: "b", weight: 0.25 }, nodes, "artists");
  assert.ok(result.components.every(({ reported, contribution }) => reported === null && contribution === null));
});

test("explains bipartite edges without artist similarity components", () => {
  const result = explainConnection({ source: "g", target: "a", weight: 0.842, link_type: "artist-genre" }, nodes, "bipartite");
  assert.deepEqual(result, { kind: "artist-genre", artistName: "Artista A", genreName: "r&b", weight: 0.842 });
  assert.equal(explainConnection({ source: "a", target: "b", weight: 0.8 }, nodes, "bipartite"), null);
});

test("ignores incomplete links instead of presenting a misleading explanation", () => {
  assert.equal(explainConnection({ source: "a", target: "unknown", weight: 0.4 }, nodes, "artists"), null);
  assert.equal(explainConnection({ source: "a", target: "b", weight: NaN }, nodes, "artists"), null);
});
