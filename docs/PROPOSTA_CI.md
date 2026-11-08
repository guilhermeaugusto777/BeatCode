# Proposta de integração contínua

## Decisão recomendada

Criar um workflow de **validação**, sem publicação nem acesso a credenciais Spotify, acionado por `pull_request` e por `push` na `main`. Manter dois jobs em `ubuntu-latest`, com `permissions: contents: read` e sem `pull_request_target`:

1. **Python 3.11:** instalar `backend/requirements-dev.txt`, executar `pytest -q` a partir de `backend/` e auditar `backend/requirements-dev.txt` com `pip-audit`. Auditar o arquivo de desenvolvimento cobre também as dependências de produção porque ele inclui `-r requirements.txt`.
2. **Node 24:** executar `npm ci --prefix frontend`, `npm run lint --prefix frontend`, `npm run build --prefix frontend` e `npm audit --prefix frontend --audit-level=moderate`.

Os testes, lint, build e ambas as auditorias passaram localmente nesta fase; a instalação a partir da raiz foi verificada em um ambiente limpo com `uv`. A execução desses jobs no GitHub ainda não foi testada. O modo demo e ambos os grafos têm testes de API; os testes OAuth são simulados e não precisam de segredos. O Canvas ainda não possui teste automatizado de interação; CI de build/lint não substitui um teste de navegador.

Usar versões oficiais atuais de `actions/checkout`, `actions/setup-python` e `actions/setup-node`, preferencialmente fixadas por SHA completo quando o workflow for implementado. Conferir a versão do runner exigida por essas actions. Desabilitar cache na primeira versão simplifica a revisão de segurança; adicioná-lo só se o tempo de execução justificar. Configurar proteção de branch apenas após o primeiro workflow passar na `main`, para não bloquear contribuições por erro de configuração.

## Limites e riscos

- A auditoria consulta a base de avisos e pode falhar por indisponibilidade externa. O erro deve ficar visível; não mascarar vulnerabilidades com `continue-on-error`.
- Dependências Python transitivas não estão travadas em lockfile. Dois jobs executados em datas distintas podem resolver versões diferentes. Um lockfile multiplataforma é uma evolução posterior, se a reprodutibilidade do CI se tornar problemática.
- ESLint 9 está fora de suporte apesar de `npm audit` limpo. Não usar o audit como substituto da política de suporte; avaliar atualização compatível em tarefa separada.
- Não incluir Spotify Client Secret, `.env` nem tokens no workflow. A integração real OAuth requer ensaio manual com contas consentidas.

Esta proposta altera infraestrutura do repositório quando implementada. O arquivo `.github/workflows/` ainda não foi criado nesta fase, conforme a regra de aprovação para infraestrutura em `AGENTS.md`.
