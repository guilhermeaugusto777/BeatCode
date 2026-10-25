# BC-002 — Auditar compatibilidade OAuth e Web API Spotify

- **Estado:** `DONE`
- **Agente responsável:** 4 — Back-end + APIs
- **Colaboradores:** 2 — Requisitos/Arquitetura; 7 — QA; 8 — Segurança/DevOps
- **Dependências:** BC-001

## Resultado esperado

O fluxo de autenticação e a coleta de dados funcionam com a configuração Spotify Developer do usuário e com endpoints/scopes vigentes; falhas têm mensagens compreensíveis.

## Checklist

- [x] Revisar funções OAuth, callback, armazenamento/renovação de token e cookies no `backend/main.py`.
- [x] Verificar `user-top-read`, `user-read-recently-played` e `user-library-read` contra os endpoints efetivamente usados.
- [x] Confirmar a disponibilidade de `/me/top/{type}`, `/me/player/recently-played` e `/me/tracks` para a modalidade da aplicação do usuário.
- [x] Verificar requisitos atuais do Development Mode: assinatura Premium do proprietário, um Client ID por desenvolvedor e allowlist de até cinco usuários em novos apps/regras aplicáveis.
- [x] Tratar 401, 403, 429 (incluindo `Retry-After`) e respostas vazias sem derrubar a interface.
- [x] Manter o modo demo sem depender de credenciais.
- [x] Atualizar `openspec/specs/spotify-auth-extraction/spec.md` e `openspec/openapi.yaml` somente se o comportamento/contrato realmente mudar.
- [x] Adicionar testes automatizados para o fluxo sem credenciais e erros conhecidos.

## Critérios de aceite

- [x] Nenhum segredo OAuth é enviado ao navegador ou versionado.
- [x] Endpoints e scopes foram confirmados em documentação oficial e no teste autorizado.
- [x] Mensagens e logs não expõem tokens ou dados privados desnecessários.
- [x] Testes disponíveis passam e o resultado real é registrado nesta nota.

## Arquivos prováveis

- `backend/main.py`
- `backend/.env.example`
- `backend/requirements.txt`
- `backend/tests/test_spotify_api.py`
- `openspec/specs/spotify-auth-extraction/spec.md` (somente se necessário)
- `openspec/openapi.yaml` (somente se necessário)

## Riscos e mitigação

- **Mudanças da Web API do Spotify (Fevereiro 2026+):** endpoints deprecados ou restrições em Development Mode (Premium obrigatório, allowlist de até 5 usuários, proibição de `http://localhost` no Redirect URI). Mitigação: validar apenas `/me/top/artists`, `/me/top/tracks`, `/me/player/recently-played` e `/me/tracks`, documentar loopback `127.0.0.1` e retornar mensagens claras para 401/403/429.
- **Vazamento de credenciais/tokens:** garantir que `access_token`/`refresh_token` permaneçam no servidor (sessão em memória vinculada a cookie `HttpOnly` + `SameSite=Lax`) e nunca apareçam em respostas JSON, query strings ou logs.
- **Indisponibilidade sem credenciais:** manter `/api/graph?demo=true` independente de credenciais OAuth.

## Casos de teste exigidos (`backend/tests/test_spotify_api.py`)

1. `GET /api/graph?demo=true` retorna `200` com `metadata`, `nodes` e `links` nos modos `artists` e `bipartite` mesmo sem credenciais Spotify configuradas.
2. `GET /auth/status` retorna `{"authenticated": false}` quando não há cookie de sessão válido.
3. `GET /auth/login` retorna `500` com mensagem clara quando `SPOTIPY_CLIENT_ID`/`SPOTIPY_CLIENT_SECRET` não estão configurados, e `307`/`302` redirecionando ao Spotify quando configurados.
4. `GET /auth/callback` valida o parâmetro `state` (rejeitando divergência contra CSRF com `400`), armazena o token no servidor e define cookie `HttpOnly` sem expor tokens na URL nem no corpo.
5. `POST /auth/logout` invalida a sessão no servidor e limpa o cookie.
6. `GET /api/graph` (autenticado) trata erros `SpotifyException` da Web API:
   - `401` → sessão expirada/inválida com limpeza de sessão;
   - `403` → orientação sobre Development Mode / allowlist de 5 usuários / conta Premium;
   - `429` → respeita cabeçalho `Retry-After` (com `retry_after` e header HTTP `Retry-After` na resposta);
   - lista vazia de artistas → retorna grafo vazio válido (`nodes: []`, `links: []`) sem erro 500.

## Log de orquestração e implementação

- **2026-10-24 (Agente 1 — Maestro):**
  - Verificadas conexões reais no canvas Maestri via `maestri list`:
    - Agente 4: `"Desenvolvedor Back-end + APIs e Integrações"`
    - Agente 7: `"QA"`
    - Agente 8: `"Revisor de Código + Segurança + DevOps"`
  - Preservadas as alterações existentes na branch `feat/bc-002-spotify-compatibility` (`backend/requirements.txt`, `backend/.env.example`, `notes/ROADMAP.md`, `notes/tasks/002-spotify-compatibility.md`).
  - Tarefa BC-002 delegada via Maestri CLI (`maestri ask`) ao terminal `"Desenvolvedor Back-end + APIs e Integrações"`.

- **2026-10-24 (Agente 4 — Back-end + APIs e Integrações):**
  - Implementado em `backend/main.py`:
    - Validação e imposição de loopback explícito `127.0.0.1` (proibição de `localhost` conforme RFC 8252 / Spotify).
    - Gerenciamento de tokens 100% no servidor via `MemoryCacheHandler` (sem arquivos `.cache` em disco) vinculado a cookie `HttpOnly` com `SameSite=Lax`.
    - Geração e validação de `state` criptográfico contra ataques CSRF no handshake `/auth/callback` (retornando HTTP 400 em divergência ou ausência).
    - Endpoints `POST /auth/logout` e `GET /auth/logout` para expurgar sessão em memória e remover cookie de sessão.
    - Scopes (`user-top-read`, `user-read-recently-played`, `user-library-read`) e chamadas à Web API (`/me/top/artists`, `/me/top/tracks`, `/me/player/recently-played`, `/me/tracks`).
    - Tratamento estruturado de `SpotifyException`:
      - HTTP 401: invalidação de sessão com remoção de cookie e resposta clara para novo login.
      - HTTP 403: mensagem com orientações sobre Development Mode (conta Premium obrigatória e allowlist de até 5 usuários).
      - HTTP 429: extração do cabeçalho `Retry-After` repassado no header da resposta e no payload JSON.
      - Lista vazia de artistas: retorno de grafo vazio válido com `metadata` estruturado, sem erro 500.
    - Modo de demonstração (`demo=true`) 100% autônomo sem credenciais do Spotify.
  - Atualizadas especificações de contrato em `openspec/specs/spotify-auth-extraction/spec.md` e `openspec/openapi.yaml`.
  - Criada suíte de testes em `backend/tests/test_spotify_api.py` cobrindo os 6 cenários exigidos.
  - Execução dos testes automatizados:
    - Comando: `backend/.venv/Scripts/python.exe -m pytest -v backend/tests`
    - Resultado: `18 passed, 1 warning in 2.70s` (100% de sucesso).
  - Estado mantido como `IN_PROGRESS` para repasse aos Agentes 7 (QA) e 8 (Revisor/Segurança).

- **2026-10-24 (Agente 4 — Hardening & Cobertura pós-revisão QA/Segurança):**
  - Implementados os 4 apontamentos de QA, Segurança e DevOps:
    - [QA]: Adicionado teste unitário `test_callback_user_denies_access_returns_400` em `backend/tests/test_spotify_api.py` para tratar `GET /auth/callback?error=access_denied`.
    - [Segurança - SEC-01]: Flag `secure` do cookie `beatcode_session` dinamizada (`is_https = request.url.scheme == "https" or os.getenv("ENVIRONMENT") == "production"`) com teste dedicado `test_login_cookie_secure_flag_dynamic`.
    - [Segurança - SEC-02]: Limpeza oportunista de sessões em memória com mais de 24 horas (`cleanup_expired_sessions()`) em `backend/main.py` com teste automatizado `test_opportunistic_cleanup_of_expired_sessions`.
    - [DevOps - DEV-02]: Adicionada regra `.cache*` no `.gitignore` contra vazamento de caches do Spotipy.
  - Execução dos testes automatizados atualizada:
    - Comando: `backend/.venv/Scripts/python.exe -m pytest -v backend/tests`
    - Resultado: `21 passed, 1 warning in 2.56s` (100% de sucesso).

- **2026-10-24 (Agente 4 — Refinamento dos 3 Pontos Cruciais Pré-Commit):**
  - **Ponto 1 (Rejeição explícita de `localhost`):** Substituição silenciosa removida em `backend/main.py`. Configurações com `localhost` em `SPOTIPY_REDIRECT_URI` passam a lançar explicitamente `HTTPException(status_code=500)` com mensagem clara de violação da RFC 8252 / Spotify. Teste correspondente `test_login_rejects_localhost_with_500` atualizado.
  - **Ponto 2 (Tratamento de `QUOTA_EXCEEDED`):** Em `backend/main.py`, inspeção de erros `SpotifyException` (403 e 429) para detecção de termos de quota (`quota` / `QUOTA_EXCEEDED`). Mensagem clara de cota da aplicação do desenvolvedor excedida no Spotify Developer Dashboard com testes dedicados `test_graph_handles_quota_exceeded_403` e `test_graph_handles_quota_exceeded_429`.
  - **Ponto 3 (Degradação Graciosa de Fontes Secundárias):** Em `GET /api/graph`, `sp.current_user_top_artists` é a fonte primária indispensável. As chamadas secundárias (`top_tracks`, `recently_played`, `saved_tracks`) agora possuem blocos isolados `try/except` com fallback para lista vazia `[]`. Se falharem, a geração dos grafos unipartido e bipartido continua com sucesso a partir dos artistas. Teste `test_graph_graceful_degradation_when_secondary_sources_fail` adicionado.
  - Execução dos testes automatizados atualizada:
    - Comando: `backend/.venv/Scripts/python.exe -m pytest -v backend/tests`
    - Resultado: `24 passed, 1 warning in 2.56s` (100% de sucesso).

- **2026-10-24 (Agente 7 — QA & Agente 8 — Segurança / DevOps):**
  - Agente 7 (QA) emitiu parecer de **APROVAÇÃO** para cobertura funcional, regressões e os 24 testes.
  - Agente 8 (Segurança/DevOps) emitiu parecer de **APROVAÇÃO** após a validação do hardening da flag `secure`, limpeza oportunista de sessões e blindagem no `.gitignore`.
  - Agente 1 (Tech Lead / Maestro): critérios de aceite técnicos integralmente atendidos. Commit realizado: `a184055` (`fix(spotify): harden OAuth, API error handling and test coverage`). Tarefa concluída (`DONE`).

## Referências oficiais

- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/documentation/web-api/concepts/rate-limits
- https://developer.spotify.com/documentation/web-api/concepts/scopes
