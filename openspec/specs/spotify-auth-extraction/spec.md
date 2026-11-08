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
- **WHEN** o Spotify redireciona para `GET /auth/callback?code=<AUTH_CODE>&state=<STATE>`
- **THEN** o backend valida e consome o `state` da sessão deste navegador, troca o `code` por tokens guardados exclusivamente em memória no backend e redireciona para `FRONTEND_URL`

### Requirement: Isolamento local das sessões OAuth
O sistema SHALL gerar um identificador aleatório de sessão por navegador e um `state` imprevisível por tentativa de login. O cookie de sessão MUST ser `HttpOnly`, `SameSite=Lax` e `Secure` sob HTTPS. Tokens e estados OAuth MUST permanecer no backend. O armazenamento em memória é temporário e destinado a um único processo local.

#### Scenario: Contas independentes
- **GIVEN** dois navegadores autenticados com contas Spotify diferentes
- **WHEN** cada um consulta `GET /api/graph`
- **THEN** cada resposta é calculada apenas com o token da respectiva sessão; a ausência de sessão autenticada retorna `401`

#### Scenario: Estado inválido, sessão expirada e logout
- **GIVEN** um `state` ausente, expirado, já utilizado ou pertencente a outro navegador
- **WHEN** o callback recebe o estado
- **THEN** a autorização é rejeitada sem vincular o token à sessão
- **GIVEN** uma sessão expirada ou encerrada via `POST /auth/logout`
- **WHEN** o navegador consulta dados privados
- **THEN** a API retorna `401` e nenhum token local da sessão encerrada permanece disponível

---

### Requirement: Multi-Horizon Musical Consumption Extraction
O sistema SHALL extrair os principais artistas (`me/top/artists`), principais faixas (`me/top/tracks`), histórico recente (`me/player/recently-played`) e faixas salvas (`me/tracks`). Os três `time_range` da API (`short_term`, `medium_term`, `long_term`) se aplicam às consultas de top artistas e top faixas. O histórico recente e as faixas salvas são consultas separadas e não seguem esse parâmetro.

#### Scenario: Extração parametrizada por período de tempo
- **GIVEN** um usuário autenticado (ou com `demo=true`)
- **WHEN** é feita uma requisição `GET /api/graph?time_range=short_term&limit=50`
- **THEN** o sistema coleta até 50 artistas e faixas correspondentes ao período `short_term` e cruza as colaborações com a biblioteca do usuário

#### Scenario: Erros de extração com resposta estável
- **GIVEN** uma requisição autenticada a `GET /api/graph`
- **WHEN** o Spotify retorna token inválido, acesso proibido, limite de chamadas, indisponibilidade ou uma lista `items` incompleta
- **THEN** a API retorna respectivamente `401`, `403`, `429`, `503` ou `502`, sem incluir a mensagem bruta do Spotify; no caso `429`, repassa `Retry-After` quando válido
