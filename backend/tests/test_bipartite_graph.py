import os
import sys
import time
from unittest.mock import MagicMock, patch, call
import pytest
from fastapi.testclient import TestClient
from spotipy.exceptions import SpotifyException
from spotipy.cache_handler import MemoryCacheHandler

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import (
    app,
    SESSIONS,
    SESSION_COOKIE_NAME,
    SCOPES,
    compute_bipartite_artist_genre_graph,
)


@pytest.fixture(autouse=True)
def clean_sessions():
    """Garante isolamento limpando o dicionário de sessões antes e depois de cada teste."""
    SESSIONS.clear()
    yield
    SESSIONS.clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def spotify_env(monkeypatch):
    monkeypatch.setenv("SPOTIPY_CLIENT_ID", "test_client_id_12345")
    monkeypatch.setenv("SPOTIPY_CLIENT_SECRET", "test_client_secret_67890")
    monkeypatch.setenv("SPOTIPY_REDIRECT_URI", "http://127.0.0.1:8000/auth/callback")
    monkeypatch.setenv("FRONTEND_URL", "http://127.0.0.1:3000")


# ==============================================================================
# 1. RESILIÊNCIA TOPOLÓGICA DO GRAFO BIPARTIDO
# ==============================================================================

def test_bipartite_all_artists_empty_genres():
    """
    Quando todos os artistas possuem genres: [], o motor cria nós semânticos agregadores
    ('eclético', 'variado') e conecta todos os artistas, garantindo links e bipartição estrita.
    """
    artists_no_genres = [
        {"id": f"art_{i}", "name": f"Indie Artist {i}", "popularity": 50, "genres": [], "images": []}
        for i in range(1, 6)
    ]

    result = compute_bipartite_artist_genre_graph(
        artists=artists_no_genres,
        top_tracks=[],
        saved_tracks=[],
        time_range="medium_term",
    )

    metadata = result["metadata"]
    assert metadata["graph_mode"] == "bipartite"
    assert metadata["empty_genres"] is True
    assert metadata["genre_coverage"] == 0.0

    # Deve conter nós de artistas (5) + nós agregadores de gênero (>= 2)
    node_types = {n["id"]: n["node_type"] for n in result["nodes"]}
    artist_nodes = [n for n in result["nodes"] if n["node_type"] == "artist"]
    genre_nodes = [n for n in result["nodes"] if n["node_type"] == "genre"]

    assert len(artist_nodes) == 5
    assert len(genre_nodes) >= 2
    assert metadata["total_nodes"] == len(artist_nodes) + len(genre_nodes)

    # Cada artista deve possuir pelo menos uma aresta para um nó de gênero
    assert len(result["links"]) >= 5
    assert metadata["total_links"] == len(result["links"])

    # Bipartição estrita: todas as arestas conectam exclusivamente artist ↔ genre
    for link in result["links"]:
        s_type = node_types[link["source"]]
        t_type = node_types[link["target"]]
        assert link["link_type"] == "artist-genre"
        assert {s_type, t_type} == {"artist", "genre"}


def test_bipartite_partial_empty_genres():
    """
    Quando parte dos artistas possui gêneros e outros não, os sem gênero são conectados
    a nós agregadores semânticos e a cobertura reflete a proporção exata.
    """
    artists = [
        {"id": "a1", "name": "Rock Icon", "genres": ["rock", "classic rock"], "popularity": 80, "images": []},
        {"id": "a2", "name": "Jazz Virtuoso", "genres": ["jazz", "bebop"], "popularity": 70, "images": []},
        {"id": "a3", "name": "Unknown Singer", "genres": [], "popularity": 40, "images": []},
        {"id": "a4", "name": "Underground Producer", "genres": [], "popularity": 35, "images": []},
    ]

    result = compute_bipartite_artist_genre_graph(
        artists=artists,
        top_tracks=[],
        saved_tracks=[],
        time_range="short_term",
    )

    metadata = result["metadata"]
    assert metadata["empty_genres"] is False
    assert metadata["genre_coverage"] == 0.5  # 2 de 4 artistas possuem gêneros

    node_types = {n["id"]: n["node_type"] for n in result["nodes"]}
    assert len(result["links"]) >= 4

    for link in result["links"]:
        assert {node_types[link["source"]], node_types[link["target"]]} == {"artist", "genre"}


def test_bipartite_single_genre_across_all_artists():
    """
    Quando todos os artistas possuem apenas 1 gênero compartilhado (selected_genres < 2),
    o motor adiciona um segundo nó agregador para garantir pelo menos 2 hubs no espaço 3D.
    """
    artists = [
        {"id": "a1", "name": "Punk 1", "genres": ["punk"], "popularity": 60, "images": []},
        {"id": "a2", "name": "Punk 2", "genres": ["punk"], "popularity": 65, "images": []},
        {"id": "a3", "name": "Punk 3", "genres": ["punk"], "popularity": 62, "images": []},
    ]

    result = compute_bipartite_artist_genre_graph(
        artists=artists,
        top_tracks=[],
        saved_tracks=[],
        time_range="long_term",
    )

    genre_nodes = [n for n in result["nodes"] if n["node_type"] == "genre"]
    assert len(genre_nodes) >= 2
    assert result["metadata"]["empty_genres"] is False
    assert result["metadata"]["genre_coverage"] == 1.0


def test_bipartite_empty_artist_list():
    """Lista vazia de artistas retorna metadados consistentes com empty_genres=True e links vazios."""
    result = compute_bipartite_artist_genre_graph(
        artists=[],
        top_tracks=[],
        saved_tracks=[],
        time_range="medium_term",
    )
    assert result["metadata"]["total_nodes"] == 0
    assert result["metadata"]["total_links"] == 0
    assert result["metadata"]["empty_genres"] is True
    assert result["metadata"]["genre_coverage"] == 0.0
    assert result["nodes"] == []
    assert result["links"] == []


# ==============================================================================
# 2. ENRIQUECIMENTO EM LOTE VIA SPOTIFY API (GET /api/graph)
# ==============================================================================

def test_api_graph_batch_genre_enrichment(client, spotify_env):
    """
    Verifica que artistas retornados com genres: [] em current_user_top_artists são
    enriquecidos em lote através de sp.artists(chunk_ids) antes de construir o grafo.
    """
    session_id = "enrichment_session"
    handler = MemoryCacheHandler(token_info={
        "access_token": "valid_tok",
        "refresh_token": "ref_tok",
        "expires_at": int(time.time()) + 3600,
        "scope": SCOPES,
    })
    SESSIONS[session_id] = {
        "cache_handler": handler,
        "created_at": time.time(),
    }
    client.cookies.set(SESSION_COOKIE_NAME, session_id)

    # current_user_top_artists retorna 2 artistas sem gêneros
    top_artists_mock = [
        {"id": "art_1", "name": "Radiohead", "genres": [], "popularity": 85, "images": []},
        {"id": "art_2", "name": "Slowdive", "genres": [], "popularity": 75, "images": []},
    ]

    # sp.artists(chunk_ids) retorna os gêneros canônicos enriquecidos
    sp_artists_response = {
        "artists": [
            {"id": "art_1", "name": "Radiohead", "genres": ["art rock", "alternative rock"]},
            {"id": "art_2", "name": "Slowdive", "genres": ["shoegaze", "dream pop"]},
        ]
    }

    with patch("spotipy.Spotify.current_user_top_artists", return_value={"items": top_artists_mock}), \
         patch("spotipy.Spotify.artists", return_value=sp_artists_response) as mock_sp_artists, \
         patch("spotipy.Spotify.current_user_top_tracks", return_value={"items": []}), \
         patch("spotipy.Spotify.current_user_recently_played", return_value={"items": []}), \
         patch("spotipy.Spotify.current_user_saved_tracks", return_value={"items": []}):

        response = client.get("/api/graph?graph_mode=bipartite")
        assert response.status_code == 200
        data = response.json()

        # sp.artists deve ter sido chamado com a lista de IDs pendentes
        mock_sp_artists.assert_called_once_with(["art_1", "art_2"])

        # O grafo final deve conter os gêneros enriquecidos
        genre_node_names = {n["name"].lower() for n in data["nodes"] if n["node_type"] == "genre"}
        assert "art rock" in genre_node_names or "shoegaze" in genre_node_names
        assert data["metadata"]["empty_genres"] is False
        assert data["metadata"]["genre_coverage"] == 1.0


def test_api_graph_batch_enrichment_chunking_over_50(client, spotify_env):
    """
    Verifica que quando há mais de 50 artistas sem gênero, o enriquecimento divide em
    lotes de no máximo 50 IDs conforme a restrição da Web API do Spotify.
    """
    session_id = "chunking_session"
    handler = MemoryCacheHandler(token_info={
        "access_token": "valid_tok",
        "refresh_token": "ref_tok",
        "expires_at": int(time.time()) + 3600,
        "scope": SCOPES,
    })
    SESSIONS[session_id] = {
        "cache_handler": handler,
        "created_at": time.time(),
    }
    client.cookies.set(SESSION_COOKIE_NAME, session_id)

    # Cria 55 artistas sem gêneros
    top_artists_mock = [
        {"id": f"art_{i}", "name": f"Artist {i}", "genres": [], "popularity": 50, "images": []}
        for i in range(1, 56)
    ]

    with patch("spotipy.Spotify.current_user_top_artists", return_value={"items": top_artists_mock}), \
         patch("spotipy.Spotify.artists", return_value={"artists": []}) as mock_sp_artists, \
         patch("spotipy.Spotify.current_user_top_tracks", return_value={"items": []}), \
         patch("spotipy.Spotify.current_user_recently_played", return_value={"items": []}), \
         patch("spotipy.Spotify.current_user_saved_tracks", return_value={"items": []}):

        response = client.get("/api/graph?graph_mode=bipartite")
        assert response.status_code == 200

        # Deve ter sido chamado 2 vezes: primeiro chunk com 50 IDs, segundo com 5 IDs
        assert mock_sp_artists.call_count == 2
        first_call_args = mock_sp_artists.call_args_list[0][0][0]
        second_call_args = mock_sp_artists.call_args_list[1][0][0]
        assert len(first_call_args) == 50
        assert len(second_call_args) == 5


def test_api_graph_enrichment_failure_gracefully_falls_back(client, spotify_env):
    """
    Se o endpoint sp.artists falhar com erro de rede ou rate limit, a requisição /api/graph
    não cai com 500; ativa os nós agregadores e gera o grafo com sucesso.
    """
    session_id = "fallback_session"
    handler = MemoryCacheHandler(token_info={
        "access_token": "valid_tok",
        "refresh_token": "ref_tok",
        "expires_at": int(time.time()) + 3600,
        "scope": SCOPES,
    })
    SESSIONS[session_id] = {
        "cache_handler": handler,
        "created_at": time.time(),
    }
    client.cookies.set(SESSION_COOKIE_NAME, session_id)

    top_artists_mock = [
        {"id": "art_1", "name": "Artist 1", "genres": [], "popularity": 60, "images": []},
        {"id": "art_2", "name": "Artist 2", "genres": [], "popularity": 65, "images": []},
    ]

    with patch("spotipy.Spotify.current_user_top_artists", return_value={"items": top_artists_mock}), \
         patch("spotipy.Spotify.artists", side_effect=SpotifyException(http_status=500, code=-1, msg="Service Error")), \
         patch("spotipy.Spotify.current_user_top_tracks", return_value={"items": []}), \
         patch("spotipy.Spotify.current_user_recently_played", return_value={"items": []}), \
         patch("spotipy.Spotify.current_user_saved_tracks", return_value={"items": []}):

        response = client.get("/api/graph?graph_mode=bipartite")
        assert response.status_code == 200
        data = response.json()

        # Resiliência ativa: nós agregadores garantem que a bipartição seja mantida
        assert data["metadata"]["empty_genres"] is True
        assert data["metadata"]["genre_coverage"] == 0.0
        assert len(data["links"]) >= 2
        genre_nodes = [n for n in data["nodes"] if n["node_type"] == "genre"]
        assert len(genre_nodes) >= 2


def test_api_graph_demo_mode_bipartite(client):
    """O modo demo no grafo bipartido retorna dados ricos com empty_genres=False e cobertura 100%."""
    response = client.get("/api/graph?demo=true&graph_mode=bipartite")
    assert response.status_code == 200
    data = response.json()

    assert data["metadata"]["graph_mode"] == "bipartite"
    assert data["metadata"]["empty_genres"] is False
    assert data["metadata"]["genre_coverage"] == 1.0
    assert len(data["nodes"]) > 0
    assert len(data["links"]) > 0
