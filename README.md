# BeatCode — Spotify 3D Music Graph & Topological Analysis

Sistema completo e autônomo de extração, modelagem em Teoria dos Grafos e visualização tridimensional interativa do gosto musical via **Spotify Web API**, construído com **FastAPI**, **NetworkX**, **Three.js** e **Next.js 14**.

---

## 🚀 Funcionalidades Principais

1. **Visualização 3D Nativa (WebGL via Three.js / React Force Graph 3D):**
   - Esferas 3D texturizadas com fotos em alta resolução dos artistas e cores representativas de comunidades musicais.
   - Gêneros mapeados como poliedros facetados (icosaedros) com acabamento aramado.
   - Arestas tridimensionais ponderadas com iluminação responsiva.
   - Controles de Câmera completos em HUD flutuante: **Zoom In**, **Zoom Out**, **Orbit (Rotação Automática)**, **Enquadrar Grafo (`zoomToFit`)** e **Resetar Visão**.
   - Navegação por mouse: Arraste com botão esquerdo para orbitar, botão direito para pan e scroll para zoom.
   - Centralização e aproximação animada ao clicar em qualquer nó.

2. **Modos de Grafo Topológico:**
   - **Grafo Unipartido (`Artistas ↔ Artistas`):** Ponderação híbrida combinando TF-IDF e Similaridade de Cosseno de gêneros (65%), colaborações diretas em faixas (25%) e co-ocorrência em sessões de escuta (10%). Poda topológica com *k-Nearest Neighbors* ($k=5$) e preservação de conectividade via *Maximum Spanning Tree* (MST).
   - **Grafo Bipartido (`Artistas ↔ Gêneros`):** Mapeamento estrito entre artistas e gêneros como partições disjuntas, evidenciando gêneros centrais que conectam diferentes vertentes musicais.

3. **Métricas Analíticas e Detecção de Comunidades:**
   - Particionamento em comunidades temáticas via algoritmo de **Louvain** determinístico e cálculo do índice de modularidade ($Q$).
   - Identificação do **Artista Ponte** (*Bridge Artist*) através de **Centralidade de Intermediação** (*Betweenness Centrality* ponderada pelo inverso da distância).

4. **Acessibilidade e Resiliência:**
   - **Drawer de Busca por Teclado:** Pressione `/` a qualquer momento para abrir uma busca rápida de artistas e gêneros, com navegação por teclado e foco automático na câmera 3D.
   - Suporte estrito a `prefers-reduced-motion` (desativa rotação contínua e aplica transições instantâneas de câmera).
   - Detecção automática de aceleração gráfica com fallback transparente para Canvas 2D caso o WebGL não esteja disponível.
   - Sanitização de entidades HTML em tooltips e liberação ativa de texturas Three.js na GPU (`.dispose()`).

5. **Modo Demo Incluso:**
   - Explore imediatamente os grafos 3D e 2D sem necessidade de credenciais do Spotify.

---

## 📋 Pré-requisitos (Windows / Linux / macOS)

- **Python:** 3.10, 3.11, 3.12 ou 3.13
- **Node.js:** 18.x, 20.x ou superior (com `npm`)
- **Git**

---

## 🔑 1. Configuração do Spotify Developer Dashboard (Regras 2026+)

Para conectar sua conta pessoal do Spotify:

1. Acesse o [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) e faça login.
2. Clique em **Create App**:
   - **App Name:** `BeatCode`
   - **App Description:** `Topological Music Graph Visualization`
   - **Redirect URI:** Adicione obrigatoriamente o IP de loopback explícito IPv4 (o uso de `localhost` é expressamente rejeitado pela RFC 8252 e pelo Spotify):
     ```text
     http://127.0.0.1:8000/auth/callback
     ```
   - **APIs used:** Selecione `Web API`.
3. Salve o aplicativo e acesse **Settings**:
   - Copie o **Client ID** e o **Client Secret**.
4. **Requisitos de Development Mode (Fevereiro 2026+):**
   - O proprietário do app deve ter uma assinatura Spotify Premium ativa.
   - Na aba **User Management**, adicione o e-mail da sua conta Spotify na allowlist (limite de até 5 usuários no modo de desenvolvimento).

---

## ⚙️ 2. Instalação e Execução do Backend

Abra um terminal (PowerShell no Windows):

```powershell
# 1. Acesse a pasta do backend
cd backend

# 2. Crie e ative o ambiente virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Configure o arquivo de ambiente
copy .env.example .env
# Edite backend/.env e insira seu SPOTIPY_CLIENT_ID e SPOTIPY_CLIENT_SECRET

# 5. Inicie o servidor FastAPI
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

O backend estará ativo em: **`http://127.0.0.1:8000`**  
Documentação OpenAPI / Swagger: **`http://127.0.0.1:8000/docs`**

---

## 🧪 3. Executando os Testes do Backend (Pytest)

Com o ambiente virtual ativado:

```powershell
pytest -v
```

A suíte conta com **46 testes automatizados** cobrindo:
- OAuth 2.0, validação de `state` CSRF, rejeição de `localhost` e cookies HttpOnly.
- Tratamento de exceções da API do Spotify (401 reconexão, 403 quota/allowlist, 429 Retry-After e degradação de fontes secundárias).
- Limpeza oportunista e cap de saturação de memória (`MAX_ACTIVE_SESSIONS = 5000`).
- Álgebra linear, TF-IDF, Louvain, k-NN, MST, centralidade de intermediação e casos de borda topológicos.

---

## 🎨 4. Instalação e Execução do Frontend

Em um segundo terminal:

```powershell
# 1. Acesse a pasta do frontend
cd frontend

# 2. Instale os pacotes npm
npm install

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse no navegador: **`http://127.0.0.1:3000`**

### Para validar o build de produção do frontend:

```powershell
npm run build
```

---

## 🎮 5. Como Utilizar a Interface

1. **Modo Demo:** Clique no botão de alternância **Demo** no cabeçalho para carregar imediatamente uma constelação musical de exemplo sem autenticação.
2. **Conectar Spotify:** Acesse `http://127.0.0.1:8000/auth/login` ou clique no botão de login para autorizar via Spotify.
3. **Alternar Modos:**
   - **Artistas ↔ Artistas:** Revela agrupamentos de afinidade e colaboração direta.
   - **Artistas ↔ Gêneros:** Revela os hubs centrais de gênero que unem seus artistas.
4. **Filtros Temporais:** Alterne entre **4 Semanas**, **6 Meses** e **Histórico**.
5. **Limiar de Arestas:** Use o slider de peso para filtrar conexões fracas e isolar os núcleos da rede.
6. **Controles 3D:**
   - **+ / -:** Zoom digital da câmera.
   - **Orbit:** Inicia/pausa a rotação orbital contínua.
   - **Enquadrar:** Executa `zoomToFit` suave englobando todos os nós visíveis.
   - **Reset:** Retorna a câmera à coordenada inicial.
   - **3D / 2D:** Alterna entre Three.js WebGL e Canvas 2D.
7. **Busca Acessível:** Pressione `/` no teclado para abrir o Drawer de busca, digite o nome de qualquer artista ou gênero e clique para a câmera voar diretamente até ele.
8. **Painel Analítico:** Clique em qualquer nó para abrir o painel lateral com métricas de centralidade, comunidade, top faixas e vizinhos navegáveis.

---

## 🔧 6. Guia de Solução de Problemas (Troubleshooting)

- **Erro `ExecutionPolicy` no PowerShell ao ativar `.venv`:**
  Execute: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` e ative novamente.
- **Erro de Redirect URI no login do Spotify:**
  Certifique-se de que cadastrou `http://127.0.0.1:8000/auth/callback` no Spotify Developer Dashboard. O uso de `localhost` é estritamente proibido pelo Spotify e retornará erro 500 pelo backend.
- **Erro 403 Forbidden na API do Spotify:**
  Sua conta Spotify deve ser Premium e estar adicionada na seção **User Management** do aplicativo no Developer Dashboard.
- **Porta 8000 ou 3000 já em uso:**
  Finalize processos anteriores ou execute em portas alternativas via `uvicorn main:app --port 8001` e `next dev -p 3001`.
- **Aceleração 3D lenta em máquinas antigas:**
  Clique no botão **3D / 2D** no HUD de controles para utilizar o modo Canvas 2D otimizado.

---

## 🏛️ 7. Decisões Arquiteturais

- **Zero-Disk Footprint:** As sessões residem exclusivamente na memória RAM do backend (`MemoryCacheHandler`), com cookies criptográficos seguros, expurgo TTL de 24 horas e teto FIFO contra esgotamento de memória. Nenhum dado do usuário ou token é gravado em disco.
- **Determinismo Matemático Estrito:** Análise topológica baseada em álgebra linear e teoria dos grafos clássica, com tempo de resposta sub-milissegundo e sem custos ou alucinações de LLMs.
- **Renderização Client-Side Estrita (Next.js 14):** Os componentes gráficos 3D e 2D utilizam `dynamic(..., { ssr: false })`, eliminando erros de compilação ou de hidratação no servidor Node.js.
