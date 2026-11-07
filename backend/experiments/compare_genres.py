"""Compare modelos de gênero sem alterar a API ou o grafo em produção."""

import json
from contextlib import contextmanager

import numpy as np
from sklearn.metrics import adjusted_rand_score

import main
from experiments.genre_representation import (
    compatible_genre_cosine_matrix,
    genre_cosine_matrix,
    legacy_genre_cosine_matrix,
)
from experiments.synthetic_data import GROUPS, make_profile


@contextmanager
def use_similarity(matrix):
    original = main.compute_genre_similarity
    main.compute_genre_similarity = lambda artists: matrix
    try:
        yield
    finally:
        main.compute_genre_similarity = original


def evaluate(data, mode, **kwargs):
    matrix = (
        legacy_genre_cosine_matrix(data["artists"]) if mode == "legacy" else
        compatible_genre_cosine_matrix(data["artists"]) if mode == "compatible" else
        genre_cosine_matrix(data["artists"], mode=mode)
    )
    with use_similarity(matrix):
        result = main.compute_unipartite_artist_graph(**data, time_range="medium_term", **kwargs)
    links = {frozenset((edge["source"], edge["target"])): edge for edge in result["links"]}
    weights = [edge["weight"] for edge in links.values()]
    labels = {node["id"]: node["cluster_id"] for node in result["nodes"]}
    known = {artist_id: group for group, ids in GROUPS.items() for artist_id in ids}
    known_ids = [artist["id"] for artist in data["artists"] if artist["id"] in known]
    cross = sum(
        known[u] != known[v]
        for key in links if len(key) == 2
        for u, v in [tuple(key)] if u in known and v in known
    ) if known_ids else None
    return result, links, {
        "edges": len(links),
        "weight_mean": round(float(np.mean(weights)), 3) if weights else 0,
        "weight_median": round(float(np.median(weights)), 3) if weights else 0,
        "weight_p90": round(float(np.percentile(weights, 90)), 3) if weights else 0,
        "communities": len(set(labels.values())),
        "modularity": result["metadata"]["modularity_score"],
        "bridge": result["metadata"]["bridge_artist"]["id"],
        "known_community_ari": round(adjusted_rand_score(
            [known[artist_id] for artist_id in known_ids],
            [labels[artist_id] for artist_id in known_ids],
        ), 3) if known_ids else None,
        "cross_group_edges": cross,
    }


def compare(data):
    baseline, baseline_links, baseline_summary = evaluate(data, "legacy")
    output = {"legacy": baseline_summary}
    for mode in ("compatible", "hybrid", "exact"):
        result, links, summary = evaluate(data, mode)
        common = baseline_links.keys() & links.keys()
        union = baseline_links.keys() | links.keys()
        summary["edge_jaccard_vs_legacy"] = round(len(common) / len(union), 3) if union else 1
        summary["mean_abs_weight_change_common"] = round(float(np.mean([
            abs(baseline_links[key]["weight"] - links[key]["weight"]) for key in common
        ])), 3) if common else 0
        summary["new_edges"] = len(links.keys() - baseline_links.keys())
        summary["removed_edges"] = len(baseline_links.keys() - links.keys())
        output[mode] = summary
    return output


if __name__ == "__main__":
    demo = main.get_demo_dataset()
    print(json.dumps({"synthetic": compare(make_profile()), "demo": compare(demo)}, indent=2))
