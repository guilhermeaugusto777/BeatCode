# BeatCode — orientação para agentes

## Contexto

- Produto: visualização do gosto musical do Spotify em grafos de artistas e gêneros.
- `backend/main.py`: API FastAPI, OAuth com Spotipy, extração e cálculo com NumPy, scikit-learn e NetworkX. `backend/index.html` é uma interface independente servida na raiz da API.
- `frontend/`: interface Next.js 14, React 18, Tailwind e `react-force-graph-2d`. Por padrão, consulta a API em `http://127.0.0.1:8000`.
- `openspec/project.md`, `openspec/openapi.yaml` e `openspec/specs/` descrevem o contrato e as regras de domínio. Ao editar `openspec/`, siga também `openspec/AGENTS.md`.

## Trabalho no projeto

- Antes de alterar um fluxo, confira a implementação, o contrato OpenAPI e a spec correspondente. Atualize a documentação quando o comportamento mudar.
- Preserve os modos `artists` e `bipartite`, os três períodos do Spotify e o modo demo sem credenciais. Valide os formatos de resposta de ambos os grafos quando mexer no motor ou na API.
- Trate o OAuth e os dados musicais como dados de usuário: nunca registre, exponha ou versione segredos e tokens. Não presuma que o cache local atual isole usuários; mudanças de autenticação ou implantação exigem decisão arquitetural explícita.
- Prefira mudanças pequenas e verificáveis. Peça aprovação antes de alterar arquitetura, dependências, infraestrutura, autenticação, custos ou comportamento importante do produto.

## Verificação disponível

- Backend: em `backend/`, criar ambiente Python 3.11, instalar `requirements-dev.txt`, executar `python -m pytest -q` e iniciar com `uvicorn main:app --host 127.0.0.1 --port 8000 --reload`.
- Frontend: em `frontend/`, usar `npm ci`, `npm run dev` e `npm run build`.
- O frontend ainda não define comandos de teste ou lint automatizados. Não afirme que passaram; registre as verificações realmente executadas.
