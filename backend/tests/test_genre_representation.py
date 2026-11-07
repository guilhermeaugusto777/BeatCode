"""Casos de contrato para preservar rótulos de gêneros na vetorização."""

import numpy as np
import pytest

from genre_representation import normalize_genre
from main import build_genre_corpus, compute_genre_similarity, compute_unipartite_artist_graph


def artist(artist_id, genres):
    return {"id": artist_id, "name": artist_id, "genres": genres, "popularity": 50, "images": []}


@pytest.mark.parametrize(
    ("raw", "exact", "parts"),
    [
        ("r&b", "r&b", ["r&b"]),
        ("R & B", "r&b", ["r&b"]),
        ("hip hop", "hip_hop", ["hip", "hop"]),
        ("drum and bass", "drum_and_bass", ["drum", "and", "bass"]),
        ("K - Pop", "k_pop", ["pop"]),
        ("neo/soul", "neo/soul", ["neo/soul"]),
        ("MPB", "mpb", ["mpb"]),
        ("Ämbïent", "ämbïent", ["ämbïent"]),
    ],
)
def test_compound_short_and_unusual_labels_survive(raw, exact, parts):
    tokens = build_genre_corpus([artist("A", [raw])])[0].split()
    assert tokens[:2] == [exact, exact]
    assert tokens[2:] == parts
    matrix = compute_genre_similarity([artist("A", [raw]), artist("B", [raw])])
    assert matrix[0, 1] == pytest.approx(1.0)


def test_empty_and_invalid_genre_lists_have_zero_similarity():
    artists = [artist("A", []), artist("B", ["", "  ", None]), artist("C", None)]
    assert build_genre_corpus(artists) == ["", "", ""]
    assert np.array_equal(compute_genre_similarity(artists), np.zeros((3, 3)))
    result = compute_unipartite_artist_graph(artists, [], [], [], "medium_term")
    assert result["links"] == []


def test_duplicate_labels_and_spacing_do_not_amplify_a_genre():
    repeated = [artist("A", [" Hip   Hop ", "hip hop", "HIP HOP"]), artist("B", ["hip hop"])]
    assert build_genre_corpus(repeated)[0] == build_genre_corpus(repeated)[1]
    assert normalize_genre(" r & b ") == "r&b"


def test_punctuation_preserves_distinct_short_genres():
    matrix = compute_genre_similarity([artist("A", ["r&b"]), artist("B", ["r&b"]), artist("C", ["k-pop"])])
    assert matrix[0, 1] == pytest.approx(1.0)
    assert matrix[0, 2] == matrix[1, 2] == 0.0


@pytest.mark.xfail(strict=True, reason="Subtermo 'and' ainda cria similaridade entre rótulos distintos")
def test_unrelated_compound_genres_should_not_match_only_on_connector():
    matrix = compute_genre_similarity([
        artist("A", ["drum and bass"]), artist("B", ["rhythm and blues"])
    ])
    assert matrix[0, 1] == 0.0
