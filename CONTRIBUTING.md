# Contribuindo com o BeatCode

Obrigado por ajudar a tornar o BeatCode mais confiável e compreensível. O projeto prioriza execução local, modo demo, dois grafos e explicações honestas sobre as métricas. Antes de mudar uma regra de domínio, leia a [arquitetura](docs/arquitetura.md), o [modelo matemático](docs/modelo-matematico.md), o [contrato OpenAPI](openspec/openapi.yaml) e a spec correspondente em [`openspec/specs/`](openspec/specs/).

## Preparar o ambiente

Use as instruções de instalação do [README](README.md), a partir da raiz do checkout. O modo demo não requer conta nem credenciais Spotify. Prefira alterações pequenas em uma branch própria e descreva o problema, a solução e como verificou o resultado no pull request.

## Verificação antes de enviar um PR

No Windows PowerShell, com o ambiente criado conforme o README:

```powershell
Push-Location backend
.\.venv\Scripts\python.exe -m pytest -q
Pop-Location
npm run lint --prefix frontend
npm run build --prefix frontend
npm audit --prefix frontend --audit-level=moderate
uvx pip-audit -r backend\requirements-dev.txt --progress-spinner off
```

Em macOS/Linux, use `backend/.venv/bin/python` no lugar do executável Windows. Registre no PR comandos executados, resultados e verificações manuais. Lint e build não validam sozinhos interação com o Canvas; quando a interface mudar, confira teclado, toque ou mouse, telas pequenas, estados de erro e ambos os modos de grafo. Os testes Python cobrem a API e os cálculos, mas não substituem essa verificação visual.

## Contratos e modelo

- Preserve `artists`, `bipartite` e `demo=true`. Ao mudar payload ou erro da API, atualize [`openspec/openapi.yaml`](openspec/openapi.yaml), a spec relevante e os testes.
- Não mude coeficientes, normalização, limiar, poda, definição de comunidades ou centralidade só porque um resultado parece melhor. Inclua casos de referência e compare impactos conforme [Validação do modelo](docs/validacao-do-modelo.md).
- Distinga dados recebidos do Spotify de inferências do BeatCode no código, na interface e na documentação. Não chame a coescuta vigente de proximidade temporal baseada em `played_at`.
- Evite adicionar uma segunda interface independente. O Next.js 2D é a interface principal nesta fase; `backend/index.html` permanece apenas como legado de transição.

## Dados, segredos e segurança

Nunca envie `.env`, Client Secret, tokens, cookies de sessão, logs de autenticação ou dados pessoais de uma conta real. Use fixtures sintéticas ou o dataset demo. Antes de anexar capturas, confirme que elas mostram apenas o demo. Não cole detalhes de uma vulnerabilidade explorável em uma issue pública; veja [SECURITY.md](SECURITY.md).

### Testes de autenticação

Os testes automatizados usam clientes Spotify simulados. Para um ensaio manual real, configure um aplicativo próprio no Spotify Developer Dashboard e cadastre exatamente `http://127.0.0.1:8000/auth/callback`; use duas contas consentidas em perfis de navegador separados. Confira `401` antes do login, isolamento A/B, rejeição de `state` ausente, alterado ou expirado, logout independente, renovação de token, respostas `429` e falhas de rede. Não registre tokens nem respostas completas do Spotify em capturas ou logs. Esse ensaio é opcional para contribuições comuns e não roda na CI.

## Escopo de um PR

Explique impactos em segurança, manutenção, desempenho e UX quando relevantes. Documente limitações conhecidas e não declare testes que não executou. Mudanças de dependências, autenticação, infraestrutura ou método matemático precisam de justificativa e revisão dos mantenedores antes da integração.
