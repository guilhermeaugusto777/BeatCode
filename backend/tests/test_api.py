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
