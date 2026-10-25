# Capability: Spotify OAuth 2.0 & Data Extraction

## Requirements

### Requirement: Loopback-Compliant OAuth 2.0 Authorization Code Flow
O sistema SHALL autenticar usuários via Spotify OAuth 2.0 Authorization Code Flow utilizando exclusivamente URIs de redirecionamento compatíveis com as políticas de segurança do Spotify (loopback explícito `http://127.0.0.1:8000/auth/callback` ou `[::1]` em ambiente de desenvolvimento, ou `https://` em produção, proibindo `localhost`).
Os escopos solicitados MUST incluir `user-top-read`, `user-read-recently-played` e `user-library-read`.
Tokens de acesso e refresh MUST ser gerenciados exclusivamente em memória no servidor (`MemoryCacheHandler`), associados à sessão via cookie seguro `HttpOnly` com `SameSite=Lax`.

#### Scenario: Redirecionamento inicial para login no Spotify
- **GIVEN** um usuário que acessa `GET /auth/login`
- **WHEN** o backend constrói a URL de autorização do Spotify
- **THEN** o usuário é redirecionado (HTTP 307) para `https://accounts.spotify.com/authorize` contendo os escopos `user-top-read user-read-recently-played user-library-read`, `redirect_uri=http://127.0.0.1:8000/auth/callback`, parâmetro `state` criptograficamente seguro e cookie de sessão `HttpOnly`.

#### Scenario: Troca de código OAuth por Access Token no Callback com proteção CSRF
- **GIVEN** que o usuário autorizou o aplicativo no Spotify
- **WHEN** o Spotify redireciona para `GET /auth/callback?code=<AUTH_CODE>&state=<STATE>`
- **THEN** o backend valida que o parâmetro `state` corresponde ao gravado na sessão (rejeitando com HTTP 400 se divergente), troca o `code` por `access_token` e `refresh_token`, armazena o token em `MemoryCacheHandler` na sessão em memória e redireciona o navegador para `FRONTEND_URL`.

#### Scenario: Encerramento de sessão (Logout)
- **GIVEN** um usuário autenticado
- **WHEN** uma requisição `POST /auth/logout` é recebida
- **THEN** o servidor limpa a sessão em memória e remove o cookie `HttpOnly`.

---

### Requirement: Multi-Horizon Musical Consumption Extraction
O sistema SHALL extrair os principais artistas (`me/top/artists`), principais faixas (`me/top/tracks`), histórico recente (`me/player/recently-played`) e faixas salvas (`me/tracks`) suportando os três períodos temporais da API do Spotify: `short_term` (4 semanas), `medium_term` (6 meses) e `long_term` (histórico completo).
O sistema SHALL tratar erros da Web API de forma estruturada: 401 (expirado/revogado), 403 (Development Mode e restrições de cota/allowlist) e 429 (Rate Limit respeitando o cabeçalho `Retry-After`). Respostas com lista de artistas vazia SHALL retornar grafos válidos vazios sem falhas internas 500.

#### Scenario: Extração parametrizada por período de tempo
- **GIVEN** um usuário autenticado (ou com `demo=true`)
- **WHEN** é feita uma requisição `GET /api/graph?time_range=short_term&limit=50`
- **THEN** o sistema coleta até 50 artistas e faixas correspondentes ao período `short_term` e cruza as colaborações com a biblioteca do usuário.

#### Scenario: Modo de demonstração sem credenciais
- **GIVEN** um usuário que não configurou credenciais do Spotify
- **WHEN** é feita uma requisição `GET /api/graph?demo=true`
- **THEN** o sistema retorna HTTP 200 com a estrutura completa do grafo (metadata, nodes e links) baseada no dataset de demonstração.
