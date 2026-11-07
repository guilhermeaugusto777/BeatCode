"""Casos pequenos que fixam o comportamento atual sem redefinir as fórmulas."""

import networkx as nx
import pytest

from main import (
    build_genre_corpus,
    compute_bipartite_artist_genre_graph,
    compute_unipartite_artist_graph,
)


def artist(name, genres):
    return {"id": name, "name": name, "genres": genres, "popularity": 50, "images": []}


def track(name, *artists):
    return {"id": name, "name": name, "artists": [{"id": a} for a in artists], "album": {"images": []}}


def graph(artists, tracks=(), recent=(), **kwargs):
    return compute_unipartite_artist_graph(
        artists, list(tracks), list(recent), [], "medium_term", **kwargs
    )


def test_identical_genre_has_cosine_one_and_composite_weight_point_65():
    result = graph([artist("A", ["shoegaze"]), artist("B", ["shoegaze"])])
    assert result["links"][0]["components"]["genre_similarity"] == 1.0
    assert result["links"][0]["weight"] == 0.65


def test_profile_local_tfidf_favors_shared_rare_genre_in_reference_case():
    artists = [
        artist("A", ["rock", "shoegaze"]),
        artist("B", ["shoegaze", "dream pop"]),
        artist("C", ["rock", "folk"]),
        artist("D", ["rock", "pop"]),
        artist("E", ["rock"]),
        artist("F", ["rock"]),
    ]
    result = graph(artists, min_weight=0.0)
    scores = {
        frozenset((edge["source"], edge["target"])): edge["components"]["genre_similarity"]
        for edge in result["links"]
    }
    assert scores[frozenset(("A", "B"))] == pytest.approx(0.609)
    assert scores[frozenset(("C", "D"))] == pytest.approx(0.242)


def test_one_collaboration_alone_creates_edge_above_default_threshold():
    result = graph(
        [artist("A", ["rock"]), artist("B", ["jazz"])],
        tracks=[track("duet", "A", "B")],
    )
    assert result["links"][0]["components"]["direct_collaboration"] == 0.5
    assert result["links"][0]["weight"] == 0.125


def test_played_at_does_not_change_current_co_listening_score():
    artists = [artist("A", ["rock"]), artist("B", ["jazz"])]
    near = [
        {"played_at": "2026-01-01T10:00:00Z", "track": track("one", "A")},
        {"played_at": "2026-01-01T10:02:00Z", "track": track("two", "B")},
    ]
    far = [
        {"played_at": "2026-01-01T10:00:00Z", "track": track("one", "A")},
        {"played_at": "2026-01-02T10:00:00Z", "track": track("two", "B")},
    ]
    near_edge = graph(artists, recent=near, min_weight=0.01)["links"][0]
    far_edge = graph(artists, recent=far, min_weight=0.01)["links"][0]
    assert near_edge["components"]["co_listening"] == 1.0
    assert far_edge["components"]["co_listening"] == 1.0
    assert near_edge["weight"] == far_edge["weight"] == 0.1


def test_maximum_spanning_tree_preserves_eligible_path_without_knn():
    artists = [artist("A", ["rock"]), artist("B", ["rock", "jazz"]), artist("C", ["jazz"])]
    result = graph(artists, k_neighbors=0)
    edges = {frozenset((edge["source"], edge["target"])) for edge in result["links"]}
    assert edges == {frozenset(("A", "B")), frozenset(("B", "C"))}
    nodes = {node["id"]: node for node in result["nodes"]}
    assert nodes["B"]["metrics"]["betweenness_centrality"] == 1.0
    assert result["metadata"]["bridge_artist"]["id"] == "B"


def test_bipartite_discards_unique_genre_of_artist_already_connected():
    artists = [artist("A", ["rock", "unique A"]), artist("B", ["rock", "unique B"])]
    result = compute_bipartite_artist_genre_graph(artists, [], [], "medium_term")
    assert {node["id"] for node in result["nodes"] if node["node_type"] == "genre"} == {"genre::rock"}
    assert len(result["links"]) == 2
    assert [node["affinity_score"] for node in result["nodes"] if node["node_type"] == "artist"] == [1.0, 0.625]
    assert sorted(edge["weight"] for edge in result["links"]) == [0.772, 1.0]


def test_bipartite_betweenness_uses_hop_count_reference():
    artists = [artist("A", ["rock"]), artist("B", ["rock", "jazz"]), artist("C", ["jazz"])]
    result = compute_bipartite_artist_genre_graph(artists, [], [], "medium_term")
    unweighted = nx.Graph()
    unweighted.add_edges_from((edge["source"], edge["target"]) for edge in result["links"])
    expected = nx.betweenness_centrality(unweighted, normalized=True)
    actual = {node["id"]: node["metrics"]["betweenness_centrality"] for node in result["nodes"]}
    assert actual["B"] == pytest.approx(round(expected["B"], 3))


def test_r_and_b_alone_should_remain_a_usable_genre():
    artists = [artist("A", ["r&b"]), artist("B", ["r&b"])]
    assert "r&b" in build_genre_corpus(artists)[0]
    assert graph(artists)["links"][0]["components"]["genre_similarity"] == 1.0
