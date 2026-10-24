# Spotify Music Graph — Análise Topológica & Visualização em Rede

Sistema completo de extração, modelagem em Teoria dos Grafos e visualização interativa do gosto musical via **Spotify Web API**, com suporte a:
- **Grafo Unipartido (`Artistas ↔ Artistas`):** Ponderação via TF-IDF + Similaridade de Cosseno de gêneros, colaborações diretas em faixas e coocorrência temporal em sessões recentes, com poda topológica ($k$-NN + *Maximum Spanning Tree*).
- **Grafo Bipartido (`Artistas ↔ Gêneros`):** Mapeia artistas e gêneros como dois conjuntos disjuntos de nós, evidenciando quais gêneros atuam como hubs conectores entre diferentes nichos.
- **Comunidades & Centralidade:** Detecção automática de nichos via algoritmo de **Louvain** e identificação do **Artista Ponte** (*Betweenness Centrality*).
- **Modo Demo Incluso:** Permite testar a visualização e alternar entre os modos Unipartido e Bipartido imediatamente, mesmo antes de configurar as chaves da API do Spotify.

---

## 1. Configuração do Spotify Developer Dashboard (Requisito de Loopback IP)

Seguindo as regras de segurança do Spotify (que proíbem `localhost` em HTTP):
1. Acesse o [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) e crie um App.
2. Em **Redirect URIs**, adicione exatamente o IP explícito de loopback IPv4:
   ```text
   http://127.0.0.1:8000/auth/callback
   ```
3. Copie o **Client ID** e o **Client Secret** para o arquivo `backend/.env` (use `backend/.env.example` como base).

---

## 2. Executando o Backend (FastAPI + Spotipy + NetworkX)

```bash
cd spotify-music-graph/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Edite o arquivo .env com seu SPOTIPY_CLIENT_ID e SPOTIPY_CLIENT_SECRET
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 3. Executando o Frontend (Next.js + React Force Graph 2D)

Em outro terminal:

```bash
cd spotify-music-graph/frontend
npm install
npm run dev
```

Acesse **`http://127.0.0.1:3000`** no navegador.
- Clique em **"Conectar Spotify"** para autenticar via OAuth 2.0, ou clique em **"Usar Dados Demo"** no topo da tela para explorar imediatamente o grafo Unipartido e Bipartido.
