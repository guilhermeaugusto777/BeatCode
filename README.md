# BeatCode

O BeatCode transforma dados musicais do Spotify em grafos interativos. O modo `artists` relaciona artistas por similaridade de gêneros, colaborações e proximidade no histórico recente. O modo `bipartite` liga artistas aos gêneros associados. Há um conjunto de demonstração que funciona sem credenciais.

## Estrutura

- `backend/main.py`: API FastAPI, autenticação Spotify, extração de dados e cálculos com NumPy, scikit-learn e NetworkX.
- `backend/index.html`: interface HTML independente servida na raiz do backend.
- `frontend/`: interface Next.js 16, React 19 e grafo Canvas 2D. Consulte também `frontend/package.json`.
- `openspec/`: contrato OpenAPI e especificações do comportamento.

## Pré-requisitos

- Python 3.11 (recomendado para as versões fixadas em `backend/requirements.txt`).
- Node.js 20.19+ e npm (validado localmente com Node 24.22.1).
- Conta e aplicativo no [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) apenas para testar dados reais.

## Executar no Windows (PowerShell)

No primeiro terminal, a partir da raiz do repositório:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
# Preencha SPOTIPY_CLIENT_ID e SPOTIPY_CLIENT_SECRET em .env para usar o Spotify.
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Em outro terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Abra `http://127.0.0.1:3000` e escolha **Explorar demonstração** para experimentar os dois grafos sem credenciais. A documentação da API fica em `http://127.0.0.1:8000/docs`.

Para autenticação real, cadastre exatamente `http://127.0.0.1:8000/auth/callback` como Redirect URI no Spotify. O callback retorna ao Next.js em `http://127.0.0.1:3000`. Se você já possui `backend/.env`, confira `FRONTEND_URL` e atualize esse valor. A interface HTML antiga permanece acessível na raiz do backend durante a comparação de funcionalidades.

Cada navegador recebe um cookie `HttpOnly`, `SameSite=Lax` e um token de sessão aleatório. Os tokens Spotify e os estados OAuth ficam somente na memória do backend. O botão de saída deve chamar `POST /auth/logout`; essa operação elimina o cache local de tokens da sessão, sem revogação no provedor. A sessão expira após oito horas; o estado de autorização, após dez minutos. O modo demo continua público.

**Limitação de desenvolvimento local:** as sessões são guardadas em memória de um único processo. Reiniciar o backend encerra todas as sessões; múltiplos workers não compartilham autenticação. Não publique esta versão como serviço multiusuário. Antes disso, será necessário um armazenamento de sessões compartilhado, política de implantação HTTPS, proteção operacional e revisão de logs. Use somente `127.0.0.1` para ambos os servidores locais; o CORS com credenciais permite apenas origens exatas configuradas.

Mantenha ambos os servidores limitados a `127.0.0.1`. O frontend usa Next.js 16 e React 19; verifique periodicamente `npm audit` e a compatibilidade das bibliotecas do grafo.

## Verificação

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

```powershell
cd frontend
npm run lint
npm run build
npm audit --audit-level=moderate
```

O frontend possui lint, mas ainda não tem suíte automatizada de interação Canvas. Não coloque credenciais nem tokens no repositório.

A revisão metodológica e os casos de referência do motor estão em `docs/REVISAO_MODELO_MATEMATICO.md`. Nenhuma fórmula foi alterada nessa revisão.

Os estudos desta fase estão em `docs/ESTUDO_GENEROS.md` e `docs/ESTUDO_TEMPORAL.md`. A proposta de explicação das ligações está em `docs/PROPOSTA_INTERPRETABILIDADE.md`; a auditoria de dependências e o roteiro de autenticação real estão em `docs/SEGURANCA_E_VALIDACAO.md`.
