# Tarefas — Interactive 3D Music Graph

## Definição e verificação

- [ ] Revisar as especificações vigentes e o componente `SpotifyConstellationGraph.jsx`.
- [ ] Verificar versões atuais das bibliotecas, compatibilidade com Next.js 14/React 18 e licença.
- [ ] Registrar decisão técnica e trade-offs na nota BC-003 antes da instalação.
- [ ] Conferir o `openspec/openapi.yaml`; manter o contrato API atual se não houver requisito de mudança.

## Implementação (dono principal: Agente 3; apoio dos agentes 2 e 4)

- [ ] Instalar apenas dependências necessárias e atualizar lockfile existente (não inventar lockfile sem confirmar gerenciador usado).
- [ ] Substituir ou adicionar visualização 3D com carregamento client-side.
- [ ] Gerar posicionamento de nós no espaço 3D e renderizar arestas com estilo baseado em `weight`.
- [ ] Diferenciar artista e gênero; preservar cluster, avatar/iniciais e labels.
- [ ] Implementar orbit/rotação, zoom, pan, auto-fit e reset de câmera.
- [ ] Preservar seleção, hover, vizinhança 1-hop, filtros, modo bipartido e painel analítico.
- [ ] Implementar feedback de erro e estado quando WebGL não estiver disponível.
- [ ] Garantir operação por controles alternativos e foco de teclado quando aplicável.

## Validação (Agente 7 + Agente 8)

- [ ] Validar modo demo sem segredo/conta Spotify.
- [ ] Validar ambos os modos e todos os períodos do seletor.
- [ ] Validar zoom in/out, pan, orbit, auto-fit e reset sem travamentos.
- [ ] Validar dataset vazio, erro HTTP e viewport móvel.
- [ ] Executar testes disponíveis e build de produção.
- [ ] Revisar diff, segredos, acessibilidade, performance e licença das dependências.
- [ ] Atualizar nota BC-003, `notes/WORKLOG.md` e estado do roadmap.
- [ ] Criar um commit da feature somente depois dos critérios de aceite passarem.
