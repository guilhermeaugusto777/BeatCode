# Segurança e validação local — novembro de 2026

## Auditoria de dependências

Após a migração, `uvx pip-audit -r requirements.txt --progress-spinner off --format columns` informou **nenhuma vulnerabilidade conhecida**. O conjunto testado em Python 3.11 usa FastAPI `0.162.2`, Starlette `1.7.0`, Spotipy `2.26.0` e python-dotenv `1.2.4`. Starlette foi fixada explicitamente para tornar a versão transitiva reproduzível. Os 52 testes passaram, com um `xfail` conhecido sobre similaridade lexical de gêneros. O aviso de descontinuação do `httpx` no TestClient da Starlette permanece e requer avaliação futura do cliente de testes.

A auditoria de `requirements-dev.txt` detectou ainda um aviso em `pytest 8.3.3`; a atualização para `9.0.3` passou nos mesmos 52 testes. A auditoria do conjunto de desenvolvimento também passou sem vulnerabilidades conhecidas.

Antes da migração, o mesmo comando relatava 18 linhas, com avisos repetidos, referentes a três pacotes e oito identificadores distintos:

| Pacote anterior | Avisos | Impacto neste código | Estado |
| --- | --- | --- | --- |
| `spotipy 2.24.0` | `PYSEC-2026-1936` | A falha envolve permissões do cache em disco. O BeatCode usa cache em memória por sessão. | Atualizado para `2.26.0`. |
| `python-dotenv 1.0.1` | `PYSEC-2026-2270` | A falha envolve escrita por `set_key`/`unset_key`; o aplicativo chama `load_dotenv`. | Atualizado para `1.2.4`. |
| `starlette 0.38.6` (transitiva de `fastapi 0.115.0`) | `PYSEC-2026-1943`, `1941`, `161`, `2281`, `2280`, `249`, `248` | Havia falhas em parsers, URLs, `StaticFiles` e métodos de endpoint. O processamento da URL afetava uma checagem de cabeçalhos privados. | FastAPI e Starlette atualizados conjuntamente para `0.162.2` e `1.7.0`. |

O caso de URL foi reproduzido antes da migração: um `Host` malformado fazia `/api/graph` responder sem `Cache-Control: no-store`. A checagem continua usando o caminho roteado em `request.scope["path"]`; o teste de regressão permanece. Manter o servidor limitado a `127.0.0.1` porque o armazenamento de sessões em memória ainda é local, independentemente do resultado da auditoria.

Em `frontend/`, `npm audit --audit-level=moderate` encontrou **zero** vulnerabilidades com o lockfile atual. O ESLint `9.39.5` está fora da janela de suporte da política oficial; `10.14.0` é a versão atual consultada. A dependência `minimatch` exigida por ESLint 10 é `^10.2.6`; o aviso de segurança verificado para essa linha recomenda a versão corrigida `11.0.1` ou posterior. A tentativa anterior de migrar para ESLint 10 trouxe esse aviso, então a recomendação é acompanhar uma correção compatível no ecossistema ou avaliar um linter alternativo em proposta própria. Não forçar `npm audit fix` ou sobrescrever a árvore sem testar o resultado.

## Sessão e CORS no ambiente local

O backend permite credenciais apenas para a origem exata configurada em `ALLOWED_ORIGINS` (padrão `http://127.0.0.1:3000`). O cookie de sessão é `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS. Tokens e estados OAuth ficam no processo backend; as sessões expiram em oito horas e o estado em dez minutos. Os testes automatizados cobrem dois navegadores, acesso cruzado, estado inválido, expiração, logout, HTTPS e CORS. O armazenamento em memória não serve a múltiplos workers nem persiste em reinicializações. Antes de uma implantação pública, será necessário armazenamento compartilhado, configuração HTTPS e revisão de proxy, Host e logs.

## Estratégia para testar autenticação real

Não há credenciais de desenvolvimento no repositório; esta fase **não realizou login real**. Para uma validação manual consentida:

1. Criar ou configurar um aplicativo de teste no Spotify Developer Dashboard com redirect exato `http://127.0.0.1:8000/auth/callback`, sem publicar segredo no repositório. Iniciar backend e Next em `127.0.0.1` com origens coincidentes.
2. Usar dois perfis de navegador separados e duas contas de teste autorizadas pelo aplicativo. Em A, concluir login e registrar apenas o identificador público exibido. Em B, verificar `401` em endpoints privados antes do login; após login próprio, confirmar que status e grafo correspondem somente a B. Repetir requisições A/B alternadas.
3. Testar tentativa de callback com `state` ausente, alterado, expirado ou originado no outro perfil. Verificar rejeição sem troca de token. Testar logout de A e confirmar `401` em A sem afetar B.
4. Em ambiente controlado, simular expiração/refresh com mocks; para uma verificação real, aguardar a expiração natural e observar recuperação ou resposta de erro sem tokens em URL, console, logs ou resposta. Não registrar payloads completos do Spotify nem screenshots com dados privados.
5. Conferir cookies em HTTP e HTTPS de desenvolvimento, `Origin` permitido e não permitido, falha de rede e `429` com `Retry-After`. Encerrar os dois perfis e remover credenciais locais de teste quando terminar.

Os testes automatizados com Spotify falso continuam sendo o gate de regressão. O ensaio real valida integração, consentimento e configuração do aplicativo; exige credenciais e contas que não estão disponíveis aqui.
