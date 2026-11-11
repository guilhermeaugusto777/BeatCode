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
        "observed_plays",
        "saved_tracks_count",
        "top_tracks_count",
        "listening_metric_type",
        "listening_metric_label",
        "listening_period",
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
    lo_borges = nodes_by_id["a10"]

    # Contagens exatas de referência em listening_count e observed_plays
    assert kendrick["listening_count"] == 1500
    assert kendrick["observed_plays"] == 1500
    assert radiohead["listening_count"] == 1000
    assert radiohead["observed_plays"] == 1000
    assert tame_impala["listening_count"] == 750
    assert tame_impala["observed_plays"] == 750
    assert milton["listening_count"] == 500
    assert milton["observed_plays"] == 500

    # Proveniência e tipo da métrica
    for n in (kendrick, radiohead, tame_impala, milton):
        assert n["listening_metric_type"] == "observed_plays"
        assert n["listening_metric_label"] == "Reproduções Observadas"
        assert n["listening_period"] == "historico_observado"

    # Faixas salvas presentes sem adulterar observed_plays
    assert kendrick["saved_tracks_count"] == 1
    assert radiohead["saved_tracks_count"] == 1
    assert tame_impala["saved_tracks_count"] == 1
    assert milton["saved_tracks_count"] == 1
    assert lo_borges["saved_tracks_count"] == 1

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
        assert isinstance(g["listening_count"], (int, float))
        assert g["listening_count"] >= 1
        assert isinstance(g["observed_plays"], int)
        assert g["observed_plays"] >= 0
        assert "saved_tracks_count" in g
        assert "top_tracks_count" in g
        assert g["listening_metric_type"] in ("observed_plays", "estimated_listening_index")
        assert isinstance(g["listening_rank"], int)
        assert g["listening_rank"] >= 1
        assert 0.0 < g["listening_ratio"] <= 1.0
        assert g["listening_source"] in ("genre_tracks_dedup", "spotify_top_affinity")
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

    # Deduplicação pura de faixa compartilhada em recent_tracks
    metrics = main.compute_listening_metrics(
        artists=[artist_1, artist_2],
        top_tracks=[],
        recent_tracks=[shared_track],
        saved_tracks=[],
        selected_genres={"rock"},
    )
    assert metrics["artist_metrics"]["art_1"]["observed_plays"] == 100
    assert metrics["artist_metrics"]["art_2"]["observed_plays"] == 100
    assert metrics["artist_metrics"]["art_1"]["listening_count"] == 100
    assert metrics["artist_metrics"]["art_2"]["listening_count"] == 100
    # O gênero 'rock' recebe a faixa compartilhada UMA ÚNICA VEZ (100, e não 200)
    assert metrics["genre_metrics"]["rock"]["observed_plays"] == 100
    assert metrics["genre_metrics"]["rock"]["listening_count"] == 100

    # Com escutas residuais explícitas nos artistas
    artist_1["observed_plays"] = 150  # residual = 150 - 100 = 50
    artist_2["observed_plays"] = 120  # residual = 120 - 100 = 20
    metrics_with_residuals = main.compute_listening_metrics(
        artists=[artist_1, artist_2],
        top_tracks=[],
        recent_tracks=[shared_track],
        saved_tracks=[],
        selected_genres={"rock"},
    )
    assert metrics_with_residuals["artist_metrics"]["art_1"]["observed_plays"] == 150
    assert metrics_with_residuals["artist_metrics"]["art_2"]["observed_plays"] == 120
    # Gênero = 100 (da faixa deduplicada) + 50 (residual art_1) + 20 (residual art_2) = 170
    assert metrics_with_residuals["genre_metrics"]["rock"]["observed_plays"] == 170
    assert metrics_with_residuals["genre_metrics"]["rock"]["listening_count"] == 170


def test_strict_separation_between_observed_plays_and_saved_library():
    """
    Regra estrita: faixas salvas NUNCA somam em reproduções ou contagem de escutas.
    Adicionar faixas a saved_tracks altera saved_tracks_count mas mantém observed_plays inalterado.
    """
    artist_obj = {
        "id": "art_sep",
        "name": "Separation Artist",
        "genres": ["indie"],
        "observed_plays": 200,
    }
    saved_items = [
        {"track": {"id": f"s_trk_{i}", "name": f"Saved Track {i}", "artists": [{"id": "art_sep"}]}}
        for i in range(10)
    ]

    metrics_without_saved = main.compute_listening_metrics(
        artists=[artist_obj],
        top_tracks=[],
        recent_tracks=[],
        saved_tracks=[],
    )
    m0 = metrics_without_saved["artist_metrics"]["art_sep"]
    assert m0["observed_plays"] == 200
    assert m0["saved_tracks_count"] == 0
    assert m0["listening_count"] == 200

    metrics_with_saved = main.compute_listening_metrics(
        artists=[artist_obj],
        top_tracks=[],
        recent_tracks=[],
        saved_tracks=saved_items,
    )
    m1 = metrics_with_saved["artist_metrics"]["art_sep"]
    assert m1["observed_plays"] == 200  # Mantido idêntico!
    assert m1["listening_count"] == 200  # Mantido idêntico!
    assert m1["saved_tracks_count"] == 10  # Incrementado corretamente!


def test_no_fictitious_counts_when_zero_observed_plays():
    """
    Regra estrita: quando observed_plays == 0, NÃO invente número fictício!
    O nó deve receber observed_plays = 0, listening_metric_type = 'estimated_listening_index',
    listening_metric_label = 'Índice Estimado de Escuta', listening_source = 'spotify_top_affinity',
    e listening_count = round(70 * affinity_score + 30 * min(1.0, top_tracks_count / 3), 2).
    """
    artist_zero = {
        "id": "art_zero",
        "name": "Zero Plays Artist",
        "genres": ["jazz"],
        # Sem observed_plays ou listening_count
    }
    top_tracks = [
        {"id": "tt1", "name": "Top Track 1", "artists": [{"id": "art_zero"}]},
        {"id": "tt2", "name": "Top Track 2", "artists": [{"id": "art_zero"}]},
    ]

    metrics = main.compute_listening_metrics(
        artists=[artist_zero],
        top_tracks=top_tracks,
        recent_tracks=[],
        saved_tracks=[],
        time_range="short_term",
    )
    m = metrics["artist_metrics"]["art_zero"]

    # observed_plays estritamente zero
    assert m["observed_plays"] == 0
    assert m["saved_tracks_count"] == 0
    assert m["top_tracks_count"] == 2
    assert m["listening_metric_type"] == "estimated_listening_index"
    assert m["listening_metric_label"] == "Índice Estimado de Escuta"
    assert m["listening_source"] == "spotify_top_affinity"
    assert m["listening_period"] == "short_term"

    # rank_idx = 0 em lista de 1 artista -> affinity_score = 1.0
    # expected_index = round(70 * 1.0 + 30 * min(1.0, 2 / 3), 2) = 70.0 + 20.0 = 90.0
    expected_index = round(70.0 * 1.0 + 30.0 * (2.0 / 3.0), 2)
    assert m["listening_count"] == expected_index


def test_clube_da_esquina_mpb_deduplication_in_demo_dataset(client):
    """
    Valida a deduplicação da faixa t2 ('Clube da Esquina Nº 2') no modo bipartido demo.
    t2 possui 2 artistas MPB (a9 Milton Nascimento e a10 Lô Borges) e 180 reproduções.
    Para o gênero MPB, t2 deve somar 180 UMA ÚNICA VEZ (e não 360).
    Total MPB = 180 (da faixa t2) + residuais dos artistas MPB = 2850.
    """
    res = client.get("/api/graph?demo=true&graph_mode=bipartite")
    assert res.status_code == 200
    data = res.json()

    mpb_node = next((n for n in data["nodes"] if n["id"] == "genre::mpb"), None)
    assert mpb_node is not None
    # 2850 comprova a deduplicação de t2 (180 uma única vez) somado aos residuais
    assert mpb_node["observed_plays"] == 2850
    assert mpb_node["listening_count"] == 2850
    assert mpb_node["listening_metric_type"] == "observed_plays"
    assert mpb_node["listening_source"] == "genre_tracks_dedup"
    assert mpb_node["listening_period"] == "historico_observado"
    assert mpb_node["connected_artists_count"] == 7  # a9..a15



