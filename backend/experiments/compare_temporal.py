"""Mede o impacto de três heurísticas temporais no grafo sintético."""

import json
import random
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import numpy as np
from sklearn.metrics import adjusted_rand_score

import main
from experiments.synthetic_data import GROUPS, make_profile
from experiments.temporal_models import temporal_matrix


@contextmanager
def use_temporal_matrix(matrix):
    original = main.compute_current_session_matrix
    main.compute_current_session_matrix = lambda artists, recent_tracks: matrix
    try:
        yield
    finally:
        main.compute_current_session_matrix = original


def evaluate(data, model, *, min_weight=0.12, k_neighbors=5, **temporal_options):
    temporal = temporal_matrix(data["artists"], data["recent_tracks"], model=model, **temporal_options)
    with use_temporal_matrix(temporal.matrix):
        result = main.compute_unipartite_artist_graph(
            **data, time_range="medium_term", min_weight=min_weight, k_neighbors=k_neighbors
        )
    links = {frozenset((link["source"], link["target"])): link for link in result["links"]}
    weights = [link["weight"] for link in links.values()]
    clusters = {node["id"]: node["cluster_id"] for node in result["nodes"]}
    known = {artist_id: group for group, ids in GROUPS.items() for artist_id in ids}
    ids = [artist_id for artist_id in known if artist_id in clusters]
    cross_edges = sum(
        known[u] != known[v]
        for key in links if len(key) == 2
        for u, v in [tuple(key)] if u in known and v in known
    )
    positive_scores = temporal.matrix[np.triu_indices(len(data["artists"]), 1)]
    return links, {
        "edges": len(links),
        "weight_mean": round(float(np.mean(weights)), 3) if weights else 0,
        "weight_median": round(float(np.median(weights)), 3) if weights else 0,
        "communities": len(set(clusters.values())),
        "known_community_ari": round(adjusted_rand_score(
            [known[artist_id] for artist_id in ids],
            [clusters[artist_id] for artist_id in ids],
        ), 3),
        "modularity": result["metadata"]["modularity_score"],
        "bridge": result["metadata"]["bridge_artist"]["id"],
        "cross_group_edges": cross_edges,
        "positive_temporal_pairs": int(np.count_nonzero(positive_scores > 1e-9)),
        "missing_timestamps": temporal.missing_timestamps,
    }


def compare(data, threshold):
    output = {}
    previous_links = None
    for model in ("current", "session", "decay", "bounded_decay"):
        links, summary = evaluate(data, model, min_weight=threshold)
        if previous_links is not None:
            union = links.keys() | previous_links.keys()
            summary["edge_jaccard_vs_current"] = round(
                len(links.keys() & previous_links.keys()) / len(union), 3
            ) if union else 1.0
        else:
            previous_links = links
        output[model] = summary
    return output


def ordering_stability(data, model, threshold=0.08):
    baseline_links, baseline = evaluate(data, model, min_weight=threshold)
    scores = []
    bridges = []
    for seed in range(10):
        variant = dict(data)
        variant["recent_tracks"] = list(data["recent_tracks"])
        random.Random(seed).shuffle(variant["recent_tracks"])
        links, summary = evaluate(variant, model, min_weight=threshold)
        union = baseline_links.keys() | links.keys()
        scores.append(len(baseline_links.keys() & links.keys()) / len(union) if union else 1.0)
        bridges.append(summary["bridge"])
    return {
        "min_edge_jaccard_vs_ordered": round(min(scores), 3),
        "mean_edge_jaccard_vs_ordered": round(float(np.mean(scores)), 3),
        "bridge_ids": sorted(set(bridges)),
    }


def main_report():
    data = make_profile()
    start = datetime(2026, 1, 1, 10, tzinfo=timezone.utc)
    pair_artists = [{"id": "A"}, {"id": "B"}]
    gap_examples = {}
    for gap in (2, 120, 1440):
        pair_events = [
            {"played_at": moment.isoformat(), "track": {"artists": [{"id": artist_id}]}}
            for moment, artist_id in [(start, "A"), (start + timedelta(minutes=gap), "B")]
        ]
        gap_examples[str(gap)] = {
            "current": round(float(temporal_matrix(pair_artists, pair_events, model="current").matrix[0, 1]), 4),
            "session_30m": round(float(temporal_matrix(pair_artists, pair_events, model="session").matrix[0, 1]), 4),
            "session_180m": round(float(temporal_matrix(pair_artists, pair_events, model="session", session_gap_minutes=180).matrix[0, 1]), 4),
            "decay_10m": round(float(temporal_matrix(pair_artists, pair_events, model="decay", half_life_minutes=10).matrix[0, 1]), 4),
            "decay_30m": round(float(temporal_matrix(pair_artists, pair_events, model="decay").matrix[0, 1]), 4),
            "decay_120m": round(float(temporal_matrix(pair_artists, pair_events, model="decay", half_life_minutes=120).matrix[0, 1]), 4),
            "bounded_decay_30m": round(float(temporal_matrix(pair_artists, pair_events, model="bounded_decay").matrix[0, 1]), 4),
        }
    return {
        "gap_examples_minutes": gap_examples,
        "default_threshold_0_12": compare(data, 0.12),
        "sensitive_threshold_0_08": compare(data, 0.08),
        "order_stability_at_0_08": {
            model: ordering_stability(data, model) for model in ("current", "session", "decay", "bounded_decay")
        },
        "pruning_sensitivity": {
            f"{model}_k{k}_min{minimum}": evaluate(
                data, model, min_weight=minimum, k_neighbors=k
            )[1]
            for model in ("current", "session", "decay", "bounded_decay")
            for k, minimum in [(0, 0.08), (2, 0.08), (5, 0.08), (5, 0.12), (5, 0.2)]
        },
        "temporal_window_sensitivity_at_0_08": {
            f"{model}_window{window}": evaluate(
                data, model, min_weight=0.08, window=window
            )[1]
            for model in ("session", "decay", "bounded_decay")
            for window in (2, 3, 5)
        },
    }


if __name__ == "__main__":
    print(json.dumps(main_report(), indent=2))
