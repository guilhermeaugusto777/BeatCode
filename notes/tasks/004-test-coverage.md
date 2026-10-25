# BC-004 — Cobertura de testes e regressão

- **Estado:** `PLANNED`
- **Agente responsável:** 7 — QA / Testador
- **Colaboradores:** 2, 3, 4, 5, 6 e 8 conforme os componentes modificados
- **Dependências:** BC-002 e BC-003

## Checklist

- [ ] Identificar o framework de testes existente; não adicionar um segundo sem justificativa.
- [ ] Cobrir normalização e validação de `nodes` e `links`.
- [ ] Cobrir os modos `artists` e `bipartite`, todos os períodos e filtros.
- [ ] Cobrir estados loading, erro, não autenticado, dataset vazio e dataset demo.
- [ ] Validar interação do grafo 3D: seleção de nó, vizinhança, zoom, pan, rotação e enquadramento.
- [ ] Validar responsividade em viewport desktop e móvel e fallback quando WebGL não está disponível.
- [ ] Executar testes do backend e `npm run build` em `frontend/`.
- [ ] Registrar comandos, resultados, limitações e eventuais bugs bloqueadores.

## Critérios de aceite

- [ ] Não há falhas regressivas conhecidas nos fluxos existentes.
- [ ] Os testes exercitam comportamento verificável, não apenas snapshots frágeis.
- [ ] Qualquer teste não executado é identificado como tal.
