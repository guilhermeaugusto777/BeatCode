# BC-002 — Auditar compatibilidade OAuth e Web API Spotify

- **Estado:** `PLANNED`
- **Agente responsável:** 4 — Back-end + APIs
- **Colaboradores:** 2 — Requisitos/Arquitetura; 7 — QA; 8 — Segurança/DevOps
- **Dependências:** BC-001

## Resultado esperado

O fluxo de autenticação e a coleta de dados funcionam com a configuração Spotify Developer do usuário e com endpoints/scopes vigentes; falhas têm mensagens compreensíveis.

## Checklist

- [ ] Revisar funções OAuth, callback, armazenamento/renovação de token e cookies no `backend/main.py`.
- [ ] Verificar `user-top-read`, `user-read-recently-played` e `user-library-read` contra os endpoints efetivamente usados.
- [ ] Confirmar a disponibilidade de `/me/top/{type}`, `/me/player/recently-played` e `/me/tracks` para a modalidade da aplicação do usuário.
- [ ] Verificar requisitos atuais do Development Mode: assinatura Premium do proprietário, um Client ID por desenvolvedor e allowlist de até cinco usuários em novos apps/regras aplicáveis.
- [ ] Tratar 401, 403, 429 (incluindo `Retry-After`) e respostas vazias sem derrubar a interface.
- [ ] Manter o modo demo sem depender de credenciais.
- [ ] Atualizar `openspec/specs/spotify-auth-extraction/spec.md` e `openspec/openapi.yaml` somente se o comportamento/contrato realmente mudar.
- [ ] Adicionar testes automatizados para o fluxo sem credenciais e erros conhecidos.

## Critérios de aceite

- [ ] Nenhum segredo OAuth é enviado ao navegador ou versionado.
- [ ] Endpoints e scopes foram confirmados em documentação oficial e no teste autorizado.
- [ ] Mensagens e logs não expõem tokens ou dados privados desnecessários.
- [ ] Testes disponíveis passam e o resultado real é registrado nesta nota.

## Referências oficiais

- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/documentation/web-api/concepts/rate-limits
- https://developer.spotify.com/documentation/web-api/concepts/scopes
