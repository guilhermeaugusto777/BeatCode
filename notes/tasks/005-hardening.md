# BC-005 — Acessibilidade, desempenho e hardening

- **Estado:** `PLANNED`
- **Agente responsável:** 8 — Revisor de Código + Segurança + DevOps
- **Colaboradores:** 3 — Front-end/Acessibilidade; 4 — Backend; 7 — QA
- **Dependências:** BC-002 e BC-003

## Checklist

- [ ] Revisar dependências novas, licença, compatibilidade com React 18 e vulnerabilidades conhecidas.
- [ ] Conferir segredos, `.env`, caches, `node_modules`, builds e bytecode no controle de versão.
- [ ] Verificar `prefers-reduced-motion`, foco visível, controles com nomes acessíveis e interação alternativa aos gestos do mouse.
- [ ] Verificar contraste de rótulos e nós, painel analítico e mensagens de erro.
- [ ] Evitar loops desnecessários de renderização/forças e controlar o custo de imagens/labels.
- [ ] Confirmar build e instruções de execução.
- [ ] Registrar achados com severidade e correções recomendadas.

## Critérios de aceite

- [ ] Nenhum segredo ou dado privado entra no diff.
- [ ] Há caminho utilizável sem depender exclusivamente de mouse/gestos 3D.
- [ ] Os checks disponíveis passam ou as falhas conhecidas estão explicitamente documentadas.
