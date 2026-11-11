from fastapi.testclient import TestClient
from spotipy.exceptions import SpotifyException
from spotipy.oauth2 import SpotifyOauthError
from requests.exceptions import ConnectionError
import pytest

import main


@pytest.fixture
def session_cookie():
    session_id = "test-session"
    main.SESSIONS[session_id] = main.LocalSession()
    yield session_id
    main.SESSIONS.clear()


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


def client_with_session(session_id):
    client = TestClient(main.app, raise_server_exceptions=False)
    client.cookies.set(main.SESSION_COOKIE_NAME, session_id)
    return client


def test_demo_endpoints_work_without_spotify_credentials(monkeypatch):
    monkeypatch.delenv("SPOTIPY_CLIENT_ID", raising=False)
    monkeypatch.delenv("SPOTIPY_CLIENT_SECRET", raising=False)
    with TestClient(main.app) as client:
        for mode in ("artists", "bipartite"):
            response = client.get(f"/api/graph?demo=true&graph_mode={mode}")
            assert response.status_code == 200
            payload = response.json()
            assert payload["metadata"]["graph_mode"] == mode
            assert payload["metadata"]["total_nodes"] == len(payload["nodes"])
            assert payload["metadata"]["total_links"] == len(payload["links"])


def test_graph_query_validation():
    with TestClient(main.app) as client:
        assert client.get("/api/graph?demo=true&graph_mode=unknown").status_code == 422
        assert client.get("/api/graph?demo=true&limit=51").status_code == 422


def test_unauthenticated_graph_requires_login(monkeypatch):
    monkeypatch.delenv("SPOTIPY_CLIENT_ID", raising=False)
    monkeypatch.delenv("SPOTIPY_CLIENT_SECRET", raising=False)
    with TestClient(main.app) as client:
        assert client.get("/auth/status").json() == {"authenticated": False}
        assert client.get("/api/graph").status_code == 401


class FailingSpotify:
    def __init__(self, error):
        self.error = error

    def current_user_top_artists(self, **kwargs):
        raise self.error


def test_spotify_rate_limit_returns_retry_after(monkeypatch, session_cookie):
    monkeypatch.setattr(
        main,
        "get_spotify_client",
        lambda request: FailingSpotify(
            SpotifyException(429, -1, "rate limit", headers={"Retry-After": "7"})
        ),
    )
    with client_with_session(session_cookie) as client:
        response = client.get("/api/graph")
    assert response.status_code == 429
    assert response.headers["retry-after"] == "7"
    assert "rate limit" not in response.text.lower()


def test_spotify_expired_or_invalid_token_requires_reconnection(monkeypatch, session_cookie):
    monkeypatch.setattr(
        main,
        "get_spotify_client",
        lambda request: FailingSpotify(SpotifyException(401, -1, "invalid token")),
    )
    with client_with_session(session_cookie) as client:
        response = client.get("/api/graph")
    assert response.status_code == 401
    assert "invalid token" not in response.text.lower()


def test_spotify_unavailable_returns_service_unavailable(monkeypatch, session_cookie):
    monkeypatch.setattr(
        main,
        "get_spotify_client",
        lambda request: FailingSpotify(SpotifyException(503, -1, "upstream unavailable")),
    )
    with client_with_session(session_cookie) as client:
        response = client.get("/api/graph")
    assert response.status_code == 503


def test_spotify_network_failure_returns_service_unavailable(monkeypatch, session_cookie):
    monkeypatch.setattr(main, "get_spotify_client", lambda request: FailingSpotify(ConnectionError()))
    with client_with_session(session_cookie) as client:
        response = client.get("/api/graph")
    assert response.status_code == 503


def test_token_refresh_failure_requires_reconnection(monkeypatch, session_cookie):
    class ExpiredOAuth:
        class Cache:
            def get_cached_token(self):
                return {"refresh_token": "test-only"}

        cache_handler = Cache()

        def validate_token(self, token):
            raise SpotifyOauthError("expired", error="invalid_grant")

    monkeypatch.setattr(main, "get_spotify_oauth", lambda cache_handler=None: ExpiredOAuth())
    with client_with_session(session_cookie) as client:
        response = client.get("/api/graph")
    assert response.status_code == 401


def test_incomplete_cached_token_requires_reconnection(monkeypatch, session_cookie):
    class IncompleteOAuth:
        class Cache:
            def get_cached_token(self):
                return {"scope": main.SCOPES}

        cache_handler = Cache()

        def validate_token(self, token):
            return token

    monkeypatch.setattr(main, "get_spotify_oauth", lambda cache_handler=None: IncompleteOAuth())
    with client_with_session(session_cookie) as client:
        response = client.get("/api/graph")
    assert response.status_code == 401


def test_spotify_forbidden_is_explained_without_upstream_details(monkeypatch, session_cookie):
    monkeypatch.setattr(
        main,
        "get_spotify_client",
        lambda request: FailingSpotify(SpotifyException(403, -1, "secret upstream detail")),
    )
    with client_with_session(session_cookie) as client:
        response = client.get("/api/graph")
    assert response.status_code == 403
    assert "secret upstream detail" not in response.text


def test_incomplete_spotify_response_is_not_silently_empty(monkeypatch, session_cookie):
    class IncompleteSpotify:
        def current_user_top_artists(self, **kwargs):
            return {}

        def current_user_top_tracks(self, **kwargs):
            return {"items": []}

        def current_user_recently_played(self, **kwargs):
            return {"items": []}

        def current_user_saved_tracks(self, **kwargs):
            return {"items": []}

    monkeypatch.setattr(main, "get_spotify_client", lambda request: IncompleteSpotify())
    with client_with_session(session_cookie) as client:
        response = client.get("/api/graph")
    assert response.status_code == 502
    assert "artistas" in response.json()["detail"].lower()


def test_incomplete_spotify_artist_item_returns_bad_gateway(monkeypatch, session_cookie):
    class IncompleteSpotify:
        def current_user_top_artists(self, **kwargs):
            return {"items": [{}]}

    monkeypatch.setattr(main, "get_spotify_client", lambda request: IncompleteSpotify())
    with client_with_session(session_cookie) as client:
        response = client.get("/api/graph")
    assert response.status_code == 502


def test_graph_endpoint_delivers_connected_artists_count_and_provenance_contract(client):
    res_bipartite = client.get("/api/graph?graph_mode=bipartite&demo=true")
    assert res_bipartite.status_code == 200
    bipartite_payload = res_bipartite.json()

    res_artists = client.get("/api/graph?graph_mode=artists&demo=true")
    assert res_artists.status_code == 200
    artists_payload = res_artists.json()

    # a) Todos os nós genre no modo bipartite possuem connected_artists_count inteiro >= 1 consistente com as arestas artist-genre
    genre_edge_counts = {}
    for link in bipartite_payload["links"]:
        assert link["link_type"] == "artist-genre"
        genre_edge_counts[link["target"]] = genre_edge_counts.get(link["target"], 0) + 1

    genre_nodes = [n for n in bipartite_payload["nodes"] if n["node_type"] == "genre"]
    assert len(genre_nodes) > 0
    for g_node in genre_nodes:
        assert isinstance(g_node["connected_artists_count"], int)
        assert g_node["connected_artists_count"] >= 1
        assert g_node["connected_artists_count"] == genre_edge_counts.get(g_node["id"], 0)

    # b) Todos os nós artist em ambos os modos possuem a chave "connected_artists_count" com valor None
    bipartite_artists = [n for n in bipartite_payload["nodes"] if n["node_type"] == "artist"]
    assert len(bipartite_artists) > 0
    for node in bipartite_artists:
        assert "connected_artists_count" in node
        assert node["connected_artists_count"] is None

    unipartite_artists = [n for n in artists_payload["nodes"] if n["node_type"] == "artist"]
    assert len(unipartite_artists) > 0
    for node in unipartite_artists:
        assert "connected_artists_count" in node
        assert node["connected_artists_count"] is None

    # c) Presença dos campos de origem Spotify e inferidos pelo BeatCode
    spotify_artist_fields = [
        "name",
        "affinity_rank",
        "global_popularity",
        "genres",
        "top_tracks",
        "spotify_url",
        "image_url",
    ]
    beatcode_node_inferences = [
        "affinity_score",
        "metrics",
        "cluster_id",
        "connected_artists_count",
        "listening_count",
        "listening_rank",
        "listening_ratio",
        "listening_source",
    ]

    for payload in (bipartite_payload, artists_payload):
        for node in [n for n in payload["nodes"] if n["node_type"] == "artist"]:
            for field in spotify_artist_fields:
                assert field in node, f"Missing Spotify field: {field}"
            for field in beatcode_node_inferences:
                assert field in node, f"Missing BeatCode inference field: {field}"
            assert "degree_centrality" in node["metrics"]
            assert "betweenness_centrality" in node["metrics"]

    # Arestas unipartidas
    assert len(artists_payload["links"]) > 0
    for link in artists_payload["links"]:
        assert link["link_type"] == "artist-artist"
        assert "weight" in link
        assert "shared_genres" in link
        assert "components" in link
        assert "genre_similarity" in link["components"]
        assert "direct_collaboration" in link["components"]
        assert "co_listening" in link["components"]


def test_demo_dataset_listening_metrics_and_reference_ratios(client):
    res_artists = client.get("/api/graph?demo=true&graph_mode=artists")
    assert res_artists.status_code == 200
    data_artists = res_artists.json()

    # Verifica metadata
    assert data_artists["metadata"]["max_artist_listening_count"] == 1500
    assert data_artists["metadata"]["max_genre_listening_count"] is None

    nodes_by_id = {n["id"]: n for n in data_artists["nodes"]}
    kendrick = nodes_by_id["a16"]
    radiohead = nodes_by_id["a1"]
    tame_impala = nodes_by_id["a4"]
    milton = nodes_by_id["a9"]

    # Contagens exatas de referência
    assert kendrick["listening_count"] == 1500
    assert radiohead["listening_count"] == 1000
    assert tame_impala["listening_count"] == 750
    assert milton["listening_count"] == 500

    # Ranks e ratios
    assert kendrick["listening_rank"] == 1
    assert kendrick["listening_ratio"] == 1.0
    assert radiohead["listening_ratio"] == round(1000 / 1500, 6)
    assert tame_impala["listening_ratio"] == round(750 / 1500, 6)
    assert milton["listening_ratio"] == round(500 / 1500, 6)

    # Razões exatas solicitadas no requisito
    assert kendrick["listening_count"] / radiohead["listening_count"] == 1.5
    assert radiohead["listening_count"] / milton["listening_count"] == 2.0
    assert radiohead["listening_count"] / tame_impala["listening_count"] == 4 / 3

    # Dimensionamento linear proporcional de val
    for n in (kendrick, radiohead, tame_impala, milton):
        expected_val = round(28.0 * n["listening_ratio"], 4)
        assert n["val"] == expected_val

    # Modo bipartido
    res_bipartite = client.get("/api/graph?demo=true&graph_mode=bipartite")
    assert res_bipartite.status_code == 200
    data_bipartite = res_bipartite.json()

    assert data_bipartite["metadata"]["max_artist_listening_count"] == 1500
    assert isinstance(data_bipartite["metadata"]["max_genre_listening_count"], int)
    assert data_bipartite["metadata"]["max_genre_listening_count"] > 0

    genre_nodes = [n for n in data_bipartite["nodes"] if n["node_type"] == "genre"]
    assert len(genre_nodes) > 0
    for g in genre_nodes:
        assert isinstance(g["listening_count"], int)
        assert g["listening_count"] >= 1
        assert isinstance(g["listening_rank"], int)
        assert g["listening_rank"] >= 1
        assert 0.0 < g["listening_ratio"] <= 1.0
        assert g["listening_source"] == "genre_tracks_dedup"
        assert g["val"] == round(24.0 * g["listening_ratio"], 4)


def test_genre_listening_deduplication_for_shared_tracks():
    artist_1 = {"id": "art_1", "name": "Artist 1", "genres": ["rock"]}
    artist_2 = {"id": "art_2", "name": "Artist 2", "genres": ["rock"]}
    shared_track = {
        "id": "trk_shared",
        "name": "Shared Track",
        "artists": [{"id": "art_1"}, {"id": "art_2"}],
        "play_count": 100,
    }

    # Deduplicação pura de faixa compartilhada
    metrics = main.compute_listening_metrics(
        artists=[artist_1, artist_2],
        top_tracks=[shared_track],
        recent_tracks=[],
        saved_tracks=[],
        selected_genres={"rock"},
    )
    assert metrics["artist_metrics"]["art_1"]["listening_count"] == 100
    assert metrics["artist_metrics"]["art_2"]["listening_count"] == 100
    # O gênero 'rock' recebe a faixa compartilhada UMA ÚNICA VEZ (100, e não 200)
    assert metrics["genre_metrics"]["rock"]["listening_count"] == 100

    # Com escutas residuais explícitas nos artistas
    artist_1["listening_count"] = 150  # residual = 150 - 100 = 50
    artist_2["listening_count"] = 120  # residual = 120 - 100 = 20
    metrics_with_residuals = main.compute_listening_metrics(
        artists=[artist_1, artist_2],
        top_tracks=[shared_track],
        recent_tracks=[],
        saved_tracks=[],
        selected_genres={"rock"},
    )
    assert metrics_with_residuals["artist_metrics"]["art_1"]["listening_count"] == 150
    assert metrics_with_residuals["artist_metrics"]["art_2"]["listening_count"] == 120
    # Gênero = 100 (da faixa deduplicada) + 50 (residual art_1) + 20 (residual art_2) = 170
    assert metrics_with_residuals["genre_metrics"]["rock"]["listening_count"] == 170


