from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

import main


class FakeOAuth:
    def __init__(self, cache_handler):
        self.cache_handler = cache_handler

    def get_authorize_url(self, state=None):
        return f"https://accounts.spotify.com/authorize?state={state}"

    def get_access_token(self, code, as_dict=True, check_cache=True):
        assert check_cache is False
        token = {
            "access_token": f"fake-access-{code}",
            "refresh_token": f"fake-refresh-{code}",
            "scope": main.SCOPES,
        }
        self.cache_handler.save_token_to_cache(token)
        return token

    def validate_token(self, token):
        return token


class FakeSpotify:
    def __init__(self, auth=None, **kwargs):
        self.person = auth.removeprefix("fake-access-")

    def current_user_top_artists(self, **kwargs):
        return {"items": [{"id": self.person, "name": self.person, "genres": ["rock"], "images": []}]}

    def current_user_top_tracks(self, **kwargs):
        return {"items": []}

    def current_user_recently_played(self, **kwargs):
        return {"items": []}

    def current_user_saved_tracks(self, **kwargs):
        return {"items": []}


@pytest.fixture
def fake_spotify(monkeypatch):
    main.SESSIONS.clear()
    monkeypatch.setenv("SPOTIPY_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("SPOTIPY_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(main, "get_spotify_oauth", lambda cache_handler=None: FakeOAuth(cache_handler))
    monkeypatch.setattr(main.spotipy, "Spotify", FakeSpotify)
    yield
    main.SESSIONS.clear()


def begin_login(client):
    response = client.get("/auth/login", follow_redirects=False)
    assert response.status_code == 307
    return parse_qs(urlsplit(response.headers["location"]).query)["state"][0], response


def complete_login(client, state, person):
    response = client.get(
        f"/auth/callback?state={state}&code={person}", follow_redirects=False
    )
    assert response.status_code == 307
    return response


def test_two_browsers_have_independent_tokens_and_logout(fake_spotify):
    with TestClient(main.app) as alice, TestClient(main.app) as bob:
        assert alice.get("/api/graph").status_code == 401
        assert bob.get("/api/graph").status_code == 401

        state_alice, login_response = begin_login(alice)
        assert "httponly" in login_response.headers["set-cookie"].lower()
        assert "samesite=lax" in login_response.headers["set-cookie"].lower()
        assert bob.get("/api/graph").status_code == 401
        complete_login(alice, state_alice, "Alice")

        assert alice.get("/auth/status").json() == {"authenticated": True}
        assert bob.get("/auth/status").json() == {"authenticated": False}
        assert alice.get("/api/graph").json()["nodes"][0]["name"] == "Alice"
        assert bob.get("/api/graph").status_code == 401

        state_bob, _ = begin_login(bob)
        complete_login(bob, state_bob, "Bob")
        assert bob.get("/api/graph").json()["nodes"][0]["name"] == "Bob"
        assert alice.get("/api/graph").json()["nodes"][0]["name"] == "Alice"

        logout = alice.post("/auth/logout", headers={"Origin": "http://127.0.0.1:3000"})
        assert logout.status_code == 200
        assert alice.get("/api/graph").status_code == 401
        assert bob.get("/api/graph").json()["nodes"][0]["name"] == "Bob"
        assert "fake-access" not in str(logout.json())


def test_state_is_unique_per_attempt_and_replay_is_rejected(fake_spotify):
    with TestClient(main.app) as client:
        first, _ = begin_login(client)
        second, _ = begin_login(client)
        assert first != second
        assert len(first) >= 32
        complete_login(client, first, "Alice")
        assert client.get(f"/auth/callback?state={first}&code=Bob", follow_redirects=False).status_code == 400
        complete_login(client, second, "Bob")
        assert client.get("/api/graph").json()["nodes"][0]["name"] == "Bob"


def test_invalid_state_or_other_browsers_state_is_rejected(fake_spotify):
    with TestClient(main.app) as alice, TestClient(main.app) as bob:
        state_alice, _ = begin_login(alice)
        state_bob, _ = begin_login(bob)
        assert alice.get(f"/auth/callback?state={state_bob}&code=Bob", follow_redirects=False).status_code == 400
        assert bob.get(f"/auth/callback?state=invalid&code=Bob", follow_redirects=False).status_code == 400
        assert bob.get(f"/auth/callback?state={state_alice}&code=Alice", follow_redirects=False).status_code == 400
        assert alice.get("/api/graph").status_code == 401
        assert bob.get("/api/graph").status_code == 401


def test_expired_session_cannot_access_graph(fake_spotify):
    with TestClient(main.app) as client:
        state, _ = begin_login(client)
        complete_login(client, state, "Alice")
        session = next(iter(main.SESSIONS.values()))
        session.created_at -= main.SESSION_TTL_SECONDS + 1
        assert client.get("/api/graph").status_code == 401
        assert client.get("/auth/status").json() == {"authenticated": False}


def test_expired_state_and_logout_invalidate_local_tokens(fake_spotify):
    with TestClient(main.app) as client:
        expired_state, _ = begin_login(client)
        session = next(iter(main.SESSIONS.values()))
        session.pending_states[expired_state] -= main.STATE_TTL_SECONDS + 1
        assert client.get(
            f"/auth/callback?state={expired_state}&code=Alice", follow_redirects=False
        ).status_code == 400

        state, _ = begin_login(client)
        complete_login(client, state, "Alice")
        assert session.cache_handler.get_cached_token()["access_token"] == "fake-access-Alice"
        forbidden = client.post("/auth/logout", headers={"Origin": "http://evil.example"})
        assert forbidden.status_code == 403
        assert client.get("/api/graph").status_code == 200
        assert client.post("/auth/logout").status_code == 200
        assert session.cache_handler.get_cached_token() is None
        assert client.get("/api/graph").status_code == 401


def test_real_oauth_url_contains_state_without_token(monkeypatch):
    monkeypatch.setenv("SPOTIPY_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("SPOTIPY_CLIENT_SECRET", "test-client-secret")
    with TestClient(main.app) as client:
        state, response = begin_login(client)
        query = parse_qs(urlsplit(response.headers["location"]).query)
        assert query["state"] == [state]
        assert query["response_type"] == ["code"]
        assert "access_token" not in response.headers["location"]
        assert "refresh_token" not in response.headers["location"]


def test_secure_cookie_on_https_and_cors_allowlist(fake_spotify):
    with TestClient(main.app, base_url="https://127.0.0.1:8000") as client:
        _, response = begin_login(client)
        assert "secure" in response.headers["set-cookie"].lower()

    with TestClient(main.app) as client:
        allowed = client.options(
            "/api/graph",
            headers={"Origin": "http://127.0.0.1:3000", "Access-Control-Request-Method": "GET"},
        )
        denied = client.options(
            "/api/graph",
            headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"},
        )
        assert allowed.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
        assert allowed.headers["access-control-allow-credentials"] == "true"
        assert denied.status_code == 400
