# BeatCode

O BeatCode transforma dados musicais do Spotify em grafos interativos. O modo `artists` relaciona artistas por similaridade de gêneros, colaborações e proximidade no histórico recente. O modo `bipartite` liga artistas aos gêneros associados. Há um conjunto de demonstração que funciona sem credenciais.

## Estrutura

- `backend/main.py`: API FastAPI, autenticação Spotify, extração de dados e cálculos com NumPy, scikit-learn e NetworkX.
- `backend/index.html`: interface HTML independente servida na raiz do backend.
- `frontend/`: interface Next.js 14, React 18 e grafo Canvas 2D. Consulte também `frontend/package.json`.
- `openspec/`: contrato OpenAPI e especificações do comportamento.

## Pré-requisitos

- Python 3.11 (recomendado para as versões fixadas em `backend/requirements.txt`).
- Node.js e npm.
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

Abra `http://127.0.0.1:3000` e escolha **Usar Dados Demo** para experimentar os dois grafos sem credenciais. A documentação da API fica em `http://127.0.0.1:8000/docs`.

Para autenticação real, cadastre exatamente `http://127.0.0.1:8000/auth/callback` como Redirect URI no Spotify. O fluxo OAuth atual retorna, por padrão, à interface HTML em `http://127.0.0.1:8000`; a unificação do fluxo com o Next.js ainda está pendente. O projeto ainda usa um único cache local de token, portanto **não execute o login com contas diferentes no mesmo backend** até que haja isolamento de sessões.

Mantenha ambos os servidores limitados a `127.0.0.1`. A versão atual do Next.js tem avisos de segurança no `npm audit`; a migração proposta está em `docs/PROPOSTA_EVOLUCAO.md`.

## Verificação

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

```powershell
cd frontend
npm run build
```

O frontend ainda não possui scripts próprios de teste ou lint. Não coloque credenciais nem tokens no repositório.
