# Capability: Spotify OAuth 2.0 & Data Extraction

## Requirements

### Requirement: Loopback-Compliant OAuth 2.0 Authorization Code Flow
O sistema SHALL autenticar usuários via Spotify OAuth 2.0 Authorization Code Flow utilizando exclusivamente URIs de redirecionamento compatíveis com as políticas de segurança do Spotify (loopback explícito `http://127.0.0.1:8000/auth/callback` ou `[::1]` em ambiente de desenvolvimento, ou `https://` em produção, proibindo `localhost`).
Os escopos solicitados MUST incluir `user-top-read`, `user-read-recently-played` e `user-library-read`.

#### Scenario: Redirecionamento inicial para login no Spotify
- **GIVEN** um usuário não autenticado que acessa `GET /auth/login`
- **WHEN** o backend constrói a URL de autorização do Spotify
- **THEN** o usuário é redirecionado (HTTP 307) para `https://accounts.spotify.com/authorize` contendo os escopos `user-top-read user-read-recently-played user-library-read` e `redirect_uri=http://127.0.0.1:8000/auth/callback`

#### Scenario: Troca de código OAuth por Access Token no Callback
- **GIVEN** que o usuário autorizou o aplicativo no Spotify
- **WHEN** o Spotify redireciona para `GET /auth/callback?code=<AUTH_CODE>`
- **THEN** o backend troca o `code` por um `access_token` e `refresh_token`, persiste o token em cache seguro e redireciona o navegador para `FRONTEND_URL`

---

### Requirement: Multi-Horizon Musical Consumption Extraction
O sistema SHALL extrair os principais artistas (`me/top/artists`), principais faixas (`me/top/tracks`), histórico recente (`me/player/recently-played`) e faixas salvas (`me/tracks`) suportando os três períodos temporais da API do Spotify: `short_term` (4 semanas), `medium_term` (6 meses) e `long_term` (histórico completo).

#### Scenario: Extração parametrizada por período de tempo
- **GIVEN** um usuário autenticado (ou com `demo=true`)
- **WHEN** é feita uma requisição `GET /api/graph?time_range=short_term&limit=50`
- **THEN** o sistema coleta até 50 artistas e faixas correspondentes ao período `short_term` e cruza as colaborações com a biblioteca do usuário
