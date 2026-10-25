import os
import time
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from spotipy.exceptions import SpotifyException
from spotipy.cache_handler import MemoryCacheHandler

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app, SESSIONS, SESSION_COOKIE_NAME, SCOPES


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
    """Configura credenciais válidas e loopback para o Spotify."""
    monkeypatch.setenv("SPOTIPY_CLIENT_ID", "test_client_id_12345")
    monkeypatch.setenv("SPOTIPY_CLIENT_SECRET", "test_client_secret_67890")
    monkeypatch.setenv("SPOTIPY_REDIRECT_URI", "http://127.0.0.1:8000/auth/callback")
    monkeypatch.setenv("FRONTEND_URL", "http://127.0.0.1:3000")


# ==============================================================================
# 1. Modo Demo (GET /api/graph?demo=true)
# ==============================================================================
def test_demo_graph_artists_mode_without_credentials(client, monkeypatch):
    """Verifica que o modo demo funciona sem credenciais e retorna o grafo de artistas."""
    monkeypatch.delenv("SPOTIPY_CLIENT_ID", raising=False)
    monkeypatch.delenv("SPOTIPY_CLIENT_SECRET", raising=False)

    response = client.get("/api/graph?demo=true&graph_mode=artists")
    assert response.status_code == 200
    data = response.json()

    assert "metadata" in data
    assert "nodes" in data
    assert "links" in data
    assert data["metadata"]["graph_mode"] == "artists"
    assert len(data["nodes"]) > 0
    assert len(data["links"]) > 0

    first_node = data["nodes"][0]
    assert first_node["node_type"] == "artist"
    assert "id" in first_node
    assert "name" in first_node
    assert "metrics" in first_node


def test_demo_graph_bipartite_mode_without_credentials(client, monkeypatch):
    """Verifica que o modo demo funciona no modo bipartido (Artistas ↔ Gêneros)."""
    monkeypatch.delenv("SPOTIPY_CLIENT_ID", raising=False)
    monkeypatch.delenv("SPOTIPY_CLIENT_SECRET", raising=False)

    response = client.get("/api/graph?demo=true&graph_mode=bipartite")
    assert response.status_code == 200
    data = response.json()

    assert data["metadata"]["graph_mode"] == "bipartite"
    node_types = {n["node_type"] for n in data["nodes"]}
    assert "artist" in node_types
    assert "genre" in node_types
    assert len(data["links"]) > 0


# ==============================================================================
# 2. Status de Autenticação (GET /auth/status)
# ==============================================================================
def test_auth_status_unauthenticated_no_cookie(client):
    """Retorna authenticated: False quando não há cookie de sessão."""
    response = client.get("/auth/status")
    assert response.status_code == 200
    assert response.json() == {"authenticated": False}


def test_auth_status_unauthenticated_invalid_cookie(client):
    """Retorna authenticated: False quando o cookie de sessão é inválido."""
    client.cookies.set(SESSION_COOKIE_NAME, "non_existent_session_id")
    response = client.get("/auth/status")
    assert response.status_code == 200
    assert response.json() == {"authenticated": False}


def test_auth_status_authenticated(client, spotify_env):
    """Retorna authenticated: True quando há sessão válida com token ativo."""
    session_id = "test_active_session"
    handler = MemoryCacheHandler(token_info={
        "access_token": "valid_token_xyz",
        "refresh_token": "valid_refresh_xyz",
        "expires_at": int(time.time()) + 3600,
        "scope": SCOPES,
    })
    SESSIONS[session_id] = {
        "cache_handler": handler,
        "created_at": time.time(),
    }

    client.cookies.set(SESSION_COOKIE_NAME, session_id)
    response = client.get("/auth/status")
    assert response.status_code == 200
    assert response.json() == {"authenticated": True}


# ==============================================================================
# 3. Login OAuth (GET /auth/login)
# ==============================================================================
def test_login_missing_credentials_returns_500(client, monkeypatch):
    """Retorna HTTP 500 com mensagem clara quando SPOTIPY_CLIENT_ID não está configurado."""
    monkeypatch.delenv("SPOTIPY_CLIENT_ID", raising=False)
    monkeypatch.delenv("SPOTIPY_CLIENT_SECRET", raising=False)

    response = client.get("/auth/login", follow_redirects=False)
    assert response.status_code == 500
    assert "Configure SPOTIPY_CLIENT_ID" in response.json()["detail"]


def test_login_redirect_and_loopback_compliance(client, spotify_env):
    """Gera URL de autorização com loopback 127.0.0.1, state CSRF e define cookie HttpOnly."""
    response = client.get("/auth/login", follow_redirects=False)
    assert response.status_code == 307

    location = response.headers.get("location")
    assert location is not None
    assert location.startswith("https://accounts.spotify.com/authorize")

    # Verifica conformidade RFC 8252 (loopback 127.0.0.1 e ausência de localhost)
    assert "127.0.0.1" in location
    assert "localhost" not in location.lower()

    # Verifica escopos exigidos
    assert "user-top-read" in location
    assert "user-read-recently-played" in location
    assert "user-library-read" in location

    # Verifica parâmetro state e cookie de sessão HttpOnly
    assert "state=" in location
    assert SESSION_COOKIE_NAME in response.cookies
    session_id = response.cookies.get(SESSION_COOKIE_NAME)
    assert session_id in SESSIONS
    assert SESSIONS[session_id]["state"] is not None


def test_login_rejects_localhost_with_500(client, monkeypatch):
    """Garante que 'localhost' no SPOTIPY_REDIRECT_URI seja rejeitado com HTTP 500 sem substituição silenciosa."""
    monkeypatch.setenv("SPOTIPY_CLIENT_ID", "test_id")
    monkeypatch.setenv("SPOTIPY_CLIENT_SECRET", "test_secret")
    monkeypatch.setenv("SPOTIPY_REDIRECT_URI", "http://localhost:8000/auth/callback")

    response = client.get("/auth/login", follow_redirects=False)
    assert response.status_code == 500
    assert "localhost" in response.json()["detail"].lower()
    assert "proibido" in response.json()["detail"].lower()


def test_login_cookie_secure_flag_dynamic(client, spotify_env, monkeypatch):
    """Garante flag secure=True no cookie quando ENVIRONMENT=production."""
    monkeypatch.setenv("ENVIRONMENT", "production")
    response = client.get("/auth/login", follow_redirects=False)
    assert response.status_code == 307
    set_cookie = response.headers.get("set-cookie", "")
    assert "secure" in set_cookie.lower()


def test_opportunistic_cleanup_of_expired_sessions(client, spotify_env):
    """Remove oportunamente sessões com mais de 24 horas de inatividade."""
    expired_session_id = "expired_session_24h_ago"
    SESSIONS[expired_session_id] = {
        "cache_handler": MemoryCacheHandler(),
        "created_at": time.time() - (25 * 3600),
    }
    active_session_id = "active_session_fresh"
    SESSIONS[active_session_id] = {
        "cache_handler": MemoryCacheHandler(),
        "created_at": time.time(),
    }

    client.get("/auth/status")
    assert expired_session_id not in SESSIONS
    assert active_session_id in SESSIONS


def test_cleanup_memory_saturation_cap(client, monkeypatch):
    """Descarta as sessões mais antigas (FIFO) quando o limite de MAX_ACTIVE_SESSIONS é excedido."""
    import main
    monkeypatch.setattr(main, "MAX_ACTIVE_SESSIONS", 3)

    t0 = time.time()
    SESSIONS["s1"] = {"cache_handler": MemoryCacheHandler(), "created_at": t0 - 30}
    SESSIONS["s2"] = {"cache_handler": MemoryCacheHandler(), "created_at": t0 - 20}
    SESSIONS["s3"] = {"cache_handler": MemoryCacheHandler(), "created_at": t0 - 10}
    SESSIONS["s4"] = {"cache_handler": MemoryCacheHandler(), "created_at": t0 - 5}
    SESSIONS["s5"] = {"cache_handler": MemoryCacheHandler(), "created_at": t0}

    client.get("/auth/status")
    # Deve reter apenas as 3 sessões mais recentes (s3, s4, s5) e descartar as mais antigas (s1, s2)
    assert len(SESSIONS) == 3
    assert "s1" not in SESSIONS
    assert "s2" not in SESSIONS
    assert "s3" in SESSIONS
    assert "s4" in SESSIONS
    assert "s5" in SESSIONS


# ==============================================================================
# 4. Callback OAuth (GET /auth/callback)
# ==============================================================================
def test_callback_user_denies_access_returns_400(client):
    """Rejeita com HTTP 400 e mensagem clara quando o usuário recusa autorização no Spotify."""
    response = client.get("/auth/callback?error=access_denied")
    assert response.status_code == 400
    assert "access_denied" in response.json()["detail"]
def test_callback_missing_state_or_mismatch_returns_400(client, spotify_env):
    """Rejeita requisições com divergência de state com HTTP 400 (proteção CSRF)."""
    session_id = "csrf_test_session"
    SESSIONS[session_id] = {
        "cache_handler": MemoryCacheHandler(),
        "state": "expected_state_abc",
        "created_at": time.time(),
    }
    client.cookies.set(SESSION_COOKIE_NAME, session_id)

    # State divergente
    response = client.get("/auth/callback?code=mock_code&state=wrong_state")
    assert response.status_code == 400
    assert "state" in response.json()["detail"].lower()

    # State ausente
    response_no_state = client.get("/auth/callback?code=mock_code")
    assert response_no_state.status_code == 400


def test_callback_without_session_returns_400(client, spotify_env):
    """Rejeita callback quando não há sessão associada ao cookie."""
    response = client.get("/auth/callback?code=mock_code&state=some_state")
    assert response.status_code == 400
    assert "sessão" in response.json()["detail"].lower()


def test_callback_success_stores_token_in_server_memory(client, spotify_env):
    """Callback bem-sucedido troca code por token, persiste em memória e redireciona."""
    session_id = "callback_success_session"
    valid_state = "valid_secure_state_xyz"
    handler = MemoryCacheHandler()
    SESSIONS[session_id] = {
        "cache_handler": handler,
        "state": valid_state,
        "created_at": time.time(),
    }
    client.cookies.set(SESSION_COOKIE_NAME, session_id)

    mock_token = {
        "access_token": "access_token_super_secret_123",
        "refresh_token": "refresh_token_456",
        "expires_in": 3600,
        "token_type": "Bearer",
        "scope": SCOPES,
    }

    with patch("spotipy.oauth2.SpotifyOAuth.get_access_token", return_value=mock_token):
        response = client.get(
            f"/auth/callback?code=mock_auth_code&state={valid_state}",
            follow_redirects=False,
        )

        assert response.status_code == 307
        redirect_url = response.headers.get("location")
        assert redirect_url == "http://127.0.0.1:3000"

        # Nenhum token exposto na URL de redirecionamento nem no corpo
        assert "access_token" not in redirect_url
        assert "access_token_super_secret_123" not in response.text

        # Token armazenado exclusivamente no servidor
        cached = handler.get_cached_token()
        assert cached is not None
        assert cached["access_token"] == "access_token_super_secret_123"

        # State CSRF foi invalidado/removido para evitar reutilização
        assert "state" not in SESSIONS[session_id]


# ==============================================================================
# 5. Logout (POST /auth/logout)
# ==============================================================================
def test_logout_invalidates_session_and_clears_cookie(client, spotify_env):
    """POST /auth/logout encerra a sessão no servidor e remove o cookie."""
    session_id = "session_to_logout"
    SESSIONS[session_id] = {
        "cache_handler": MemoryCacheHandler(token_info={"access_token": "tok"}),
        "created_at": time.time(),
    }
    client.cookies.set(SESSION_COOKIE_NAME, session_id)

    response = client.post("/auth/logout")
    assert response.status_code == 200
    assert response.json() == {"message": "Sessão encerrada com sucesso.", "authenticated": False}

    # Sessão deve ter sido expurgada da memória
    assert session_id not in SESSIONS

    # Status deve retornar não autenticado
    status_resp = client.get("/auth/status")
    assert status_resp.json() == {"authenticated": False}


# ==============================================================================
# 6. Extração de Dados e Tratamento de Erros da Web API (GET /api/graph)
# ==============================================================================
def test_graph_unauthenticated_returns_401(client):
    """GET /api/graph sem cookie nem demo retorna HTTP 401."""
    response = client.get("/api/graph")
    assert response.status_code == 401
    assert "não autenticado" in response.json()["detail"].lower()


def test_graph_handles_spotify_401_invalidates_session(client, spotify_env):
    """Trata SpotifyException 401: limpa a sessão no servidor e retorna 401 com instrução."""
    session_id = "expired_spotify_session"
    handler = MemoryCacheHandler(token_info={
        "access_token": "expired_tok",
        "refresh_token": "ref_tok",
        "expires_at": int(time.time()) + 3600,
        "scope": SCOPES,
    })
    SESSIONS[session_id] = {
        "cache_handler": handler,
        "created_at": time.time(),
    }
    client.cookies.set(SESSION_COOKIE_NAME, session_id)

    with patch("spotipy.Spotify.current_user_top_artists") as mock_top:
        mock_top.side_effect = SpotifyException(
            http_status=401,
            code=-1,
            msg="The access token expired",
        )
        response = client.get("/api/graph")
        assert response.status_code == 401
        assert "expirada" in response.json()["detail"].lower()
        # Sessão deve ter sido removida do servidor
        assert session_id not in SESSIONS


def test_graph_handles_spotify_403_development_mode(client, spotify_env):
    """Trata SpotifyException 403: orienta sobre regras do Development Mode (Premium + allowlist)."""
    session_id = "forbidden_session"
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

    with patch("spotipy.Spotify.current_user_top_artists") as mock_top:
        mock_top.side_effect = SpotifyException(
            http_status=403,
            code=-1,
            msg="User not registered in the Developer Dashboard",
        )
        response = client.get("/api/graph")
        assert response.status_code == 403
        detail = response.json()["detail"]
        assert "Development Mode" in detail
        assert "Premium" in detail
        assert "5 usuários" in detail


def test_graph_handles_spotify_429_rate_limit_with_retry_after(client, spotify_env):
    """Trata SpotifyException 429: extrai cabeçalho Retry-After e repassa na resposta."""
    session_id = "ratelimit_session"
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

    with patch("spotipy.Spotify.current_user_top_artists") as mock_top:
        mock_top.side_effect = SpotifyException(
            http_status=429,
            code=-1,
            msg="Rate limit exceeded",
            headers={"Retry-After": "45"},
        )
        response = client.get("/api/graph")
        assert response.status_code == 429
        assert response.headers.get("Retry-After") == "45"
        assert response.json()["retry_after"] == 45
        assert "Rate Limit" in response.json()["detail"]


def test_graph_handles_empty_artists_list_gracefully(client, spotify_env):
    """Retorna grafo vazio válido (nodes: [], links: []) sem erro 500 se o usuário não tiver histórico."""
    session_id = "empty_user_session"
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

    with patch("spotipy.Spotify.current_user_top_artists", return_value={"items": []}), \
         patch("spotipy.Spotify.current_user_top_tracks", return_value={"items": []}), \
         patch("spotipy.Spotify.current_user_recently_played", return_value={"items": []}), \
         patch("spotipy.Spotify.current_user_saved_tracks", return_value={"items": []}):

        # Modo artists
        res_artists = client.get("/api/graph?graph_mode=artists")
        assert res_artists.status_code == 200
        data_a = res_artists.json()
        assert data_a["nodes"] == []
        assert data_a["links"] == []
        assert data_a["metadata"]["total_nodes"] == 0
        assert data_a["metadata"]["total_links"] == 0

        # Modo bipartite
        res_bipartite = client.get("/api/graph?graph_mode=bipartite")
        assert res_bipartite.status_code == 200
        data_b = res_bipartite.json()
        assert data_b["nodes"] == []
        assert data_b["links"] == []
        assert data_b["metadata"]["total_nodes"] == 0
        assert data_b["metadata"]["total_links"] == 0


def test_graph_authenticated_successful_extraction(client, spotify_env):
    """Executa a extração completa e o cálculo de grafos com dados mockados do Spotify."""
    session_id = "valid_user_session"
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

    mock_artists = [
        {"id": "art_1", "name": "Artist One", "popularity": 80, "genres": ["rock", "indie"], "images": []},
        {"id": "art_2", "name": "Artist Two", "popularity": 75, "genres": ["rock", "alternative"], "images": []},
    ]
    mock_tracks = [
        {"id": "trk_1", "name": "Track One", "artists": [{"id": "art_1"}, {"id": "art_2"}], "album": {"images": []}},
    ]

    with patch("spotipy.Spotify.current_user_top_artists", return_value={"items": mock_artists}), \
         patch("spotipy.Spotify.current_user_top_tracks", return_value={"items": mock_tracks}), \
         patch("spotipy.Spotify.current_user_recently_played", return_value={"items": []}), \
         patch("spotipy.Spotify.current_user_saved_tracks", return_value={"items": []}):

        response = client.get("/api/graph?graph_mode=artists&time_range=short_term")
        assert response.status_code == 200
        data = response.json()
        assert len(data["nodes"]) == 2
        assert data["metadata"]["graph_mode"] == "artists"
        assert data["metadata"]["time_range"] == "short_term"


def test_graph_handles_quota_exceeded_403(client, spotify_env):
    """Trata SpotifyException 403 com 'QUOTA_EXCEEDED' orientando sobre limite da aplicação no Dashboard."""
    session_id = "quota_session_403"
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

    with patch("spotipy.Spotify.current_user_top_artists") as mock_top:
        mock_top.side_effect = SpotifyException(
            http_status=403,
            code=-1,
            msg="QUOTA_EXCEEDED: developer application exceeded allowable quota",
        )
        response = client.get("/api/graph")
        assert response.status_code == 403
        detail = response.json()["detail"]
        assert "QUOTA_EXCEEDED" in detail
        assert "Dashboard" in detail


def test_graph_handles_quota_exceeded_429(client, spotify_env):
    """Trata SpotifyException 429 com 'quota' orientando sobre limite no Dashboard e Retry-After."""
    session_id = "quota_session_429"
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

    with patch("spotipy.Spotify.current_user_top_artists") as mock_top:
        mock_top.side_effect = SpotifyException(
            http_status=429,
            code=-1,
            msg="Daily quota reached",
            headers={"Retry-After": "120"},
        )
        response = client.get("/api/graph")
        assert response.status_code == 429
        assert response.headers.get("Retry-After") == "120"
        assert response.json()["retry_after"] == 120
        detail = response.json()["detail"]
        assert "QUOTA_EXCEEDED" in detail
        assert "Dashboard" in detail


def test_graph_graceful_degradation_when_secondary_sources_fail(client, spotify_env):
    """Garante degradação graciosa: se fontes secundárias falharem, o grafo é gerado via top_artists."""
    session_id = "degradation_session"
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

    mock_artists = [
        {"id": "art_1", "name": "Radiohead", "popularity": 85, "genres": ["art rock", "alternative rock"], "images": []},
        {"id": "art_2", "name": "The Smile", "popularity": 70, "genres": ["art rock", "indie rock"], "images": []},
    ]

    # top_artists funciona normalmente, enquanto fontes secundárias falham com exceções
    with patch("spotipy.Spotify.current_user_top_artists", return_value={"items": mock_artists}), \
         patch("spotipy.Spotify.current_user_top_tracks", side_effect=SpotifyException(http_status=500, code=-1, msg="Tracks service unavailable")), \
         patch("spotipy.Spotify.current_user_recently_played", side_effect=Exception("Timeout")), \
         patch("spotipy.Spotify.current_user_saved_tracks", side_effect=SpotifyException(http_status=403, code=-1, msg="Scope error")):

        response = client.get("/api/graph?graph_mode=artists")
        assert response.status_code == 200
        data = response.json()
        assert len(data["nodes"]) == 2
        assert data["metadata"]["graph_mode"] == "artists"
        assert data["metadata"]["total_nodes"] == 2
        # O grafo é construído normalmente a partir dos artistas primários
        node_names = [n["name"] for n in data["nodes"]]
        assert "Radiohead" in node_names
        assert "The Smile" in node_names
