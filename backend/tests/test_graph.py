import networkx as nx

from main import (
    build_genre_corpus,
    compute_bipartite_artist_genre_graph,
    compute_unipartite_artist_graph,
    extract_artist_tracks_and_collabs,
    get_demo_dataset,
)


def artist(artist_id, genres):
    return {
        "id": artist_id,
        "name": artist_id,
        "genres": genres,
        "popularity": 50,
        "images": [],
    }


def track(track_id, *artist_ids):
    return {
        "id": track_id,
        "name": track_id,
        "artists": [{"id": artist_id} for artist_id in artist_ids],
        "album": {"images": []},
    }


def test_genre_corpus_keeps_exact_genre_and_its_terms():
    corpus = build_genre_corpus([artist("a", ["indie rock"]), artist("b", [])])
    assert corpus[0].split().count("indie_rock") == 2
    assert "indie" in corpus[0].split()
    assert corpus[1] == ""


def test_collaboration_weight_and_top_tracks_are_deduplicated():
    artists = [artist("a", []), artist("b", [])]
    shared = track("t1", "a", "b")
    top_tracks, matrix = extract_artist_tracks_and_collabs(
        artists, [shared, shared, track("t2", "a", "b")], []
    )
    assert matrix[0, 1] == matrix[1, 0] == 1.0
    assert [item["id"] for item in top_tracks["a"]] == ["t1", "t2"]


def test_unipartite_weights_include_collaboration_without_shared_genre():
    artists = [artist("a", ["rock"]), artist("b", ["jazz"])]
    result = compute_unipartite_artist_graph(
        artists, [track("t1", "a", "b"), track("t2", "a", "b")], [], [], "medium_term"
    )
    assert len(result["links"]) == 1
    edge = result["links"][0]
    assert edge["weight"] == 0.25
    assert edge["components"] == {
        "genre_similarity": 0.0,
        "direct_collaboration": 1.0,
        "co_listening": 0.0,
    }


def test_unipartite_keeps_connected_demo_and_valid_communities():
    demo = get_demo_dataset()
    result = compute_unipartite_artist_graph(**demo, time_range="medium_term")
    graph = nx.Graph((edge["source"], edge["target"]) for edge in result["links"])
    graph.add_nodes_from(node["id"] for node in result["nodes"])
    assert result["metadata"]["total_nodes"] == 26
    assert result["metadata"]["total_links"] == len(result["links"])
    assert all(edge["weight"] >= 0.12 for edge in result["links"])
    assert -0.5 <= result["metadata"]["modularity_score"] <= 1.0
    assert result["metadata"]["bridge_artist"]["id"] in graph
    assert all(node["cluster_id"] is not None for node in result["nodes"])


def test_bipartite_has_only_artist_genre_edges():
    demo = get_demo_dataset()
    result = compute_bipartite_artist_genre_graph(
        demo["artists"], demo["top_tracks"], demo["saved_tracks"], "medium_term"
    )
    types = {node["id"]: node["node_type"] for node in result["nodes"]}
    assert {"artist", "genre"} == set(types.values())
    assert all(types[edge["source"]] == "artist" for edge in result["links"])
    assert all(types[edge["target"]] == "genre" for edge in result["links"])
    assert result["metadata"]["total_links"] == len(result["links"])


def test_empty_graph_has_no_nodes_or_links():
    result = compute_unipartite_artist_graph([], [], [], [], "medium_term")
    assert result["nodes"] == result["links"] == []
