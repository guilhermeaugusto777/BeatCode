# AGENTS.md — Regras do projeto e orquestração Maestri

> Este arquivo define as regras globais do projeto e de orquestração. **As funções, responsabilidades, especialidades e instruções individuais dos agentes são definidas exclusivamente nas configurações do Maestri.** Não replique, redefina ou contradiga essas funções aqui. Em caso de dúvida sobre quem deve executar uma tarefa, consulte as funções disponíveis no Maestri e delegue ao agente cuja descrição corresponda ao trabalho.

## 1. Missão e contexto do produto

Trabalhe sobre o projeto existente, respeitando sua stack, arquitetura, convenções, design system e decisões registradas. Não presuma frameworks, bibliotecas, serviços, endpoints ou estrutura de pastas antes de inspecionar o repositório.

O escopo funcional informado para este projeto inclui, quando confirmado pelos requisitos e pelo código existente:

- Apresentação de projetos reais e verificáveis em um portfólio/site.
- Catálogo organizado de projetos, repositórios e serviços de dados.
- Busca semântica de projetos e filtragem inteligente por competências.
- Interface responsiva, acessível e consistente.
- Preferências de interface e formulário de contato, com persistência definida por requisitos explícitos.

**Verdade do projeto:** código, testes, documentação, especificações aprovadas e decisões do usuário são fontes de verdade. Nunca invente projetos, links, métricas, integrações, resultados de testes ou dados de portfólio. Quando algo não puder ser confirmado, marque como pendente ou desconhecido.

## 2. Hierarquia de instruções e identificação do agente

1. Respeite as instruções do sistema e do usuário, as decisões aprovadas e os contratos deste arquivo.
2. Leia este `AGENTS.md`, as instruções da função que recebeu do Maestri e os documentos relevantes da feature antes de agir.
3. Siga a função e o escopo definidos no Maestri como fonte de verdade da sua atuação. Este arquivo não cria funções nem altera as configurações dos agentes.
4. Em caso de conflito entre instruções, informe o Maestro com o trecho conflitante e proponha a resolução; não escolha silenciosamente.
5. A coordenação e a distribuição entre os agentes disponíveis pertencem ao Maestro. Não crie camadas adicionais de subagentes, a menos que o usuário ou a configuração do Maestri permita explicitamente.

## 3. Uso das funções já configuradas no Maestri

- Considere as funções cadastradas no Maestri como a **única fonte de verdade** para nome, especialidade, responsabilidades, limites e instruções particulares de cada agente.
- Não mantenha neste arquivo tabelas com nomes, números, descrições ou entregas individuais dos agentes. Isso evita duplicidade e divergência entre o `AGENTS.md` e as funções do Maestri.
- Antes de delegar, consulte as funções/agentes disponíveis no Maestri e selecione quem tem a competência mais adequada à tarefa.
- Delegue por capacidade e dependência técnica, não por uma sequência fixa de agentes nem por uma lista estática de cargos.
- Se nenhuma função configurada corresponder ao trabalho, o Maestro deve executar apenas o que estiver dentro de sua capacidade ou reportar a lacuna ao usuário; não invente uma nova função.

## 4. Regra central: delegar cedo e trabalhar em paralelo

O usuário autorizou o Maestro a delegar trabalho aos agentes já configurados no Maestri sempre que houver frentes independentes. **A delegação paralela é o comportamento padrão**, não uma exceção. Não peça autorização novamente a cada recrutamento de um desses papéis para tarefas normais do projeto.

### 4.1 Antes de iniciar uma feature

O Maestro deve:

1. Entender o pedido e identificar o resultado esperado.
2. Verificar branch, `git status`, estrutura do projeto, instruções e decisões existentes.
3. Consultar o Graphify quando a tarefa exigir compreensão do código ou de dependências entre módulos (ver seção 7).
4. Acionar a skill `tlc-spec-driven` para especificar, planejar, executar e verificar a feature (ver seção 6).
5. Construir um **mapa de dependências (DAG)**: separar tarefas independentes, dependências reais, responsáveis, arquivos/módulos afetados e critérios de conclusão.
6. Consultar as funções disponíveis no Maestri e recrutar, no mesmo momento, os agentes adequados às frentes independentes. Não recrute toda a equipe por padrão: selecione somente as funções necessárias para a feature.
7. Compartilhar a especificação/nota de trabalho com os agentes selecionados e conectá-los às notas necessárias no canvas do Maestri.

### 4.2 Paralelismo obrigatório quando não houver dependência

Não espere um agente terminar para só então iniciar outro trabalho que não dependa dele. Com base nas funções cadastradas no Maestri e no escopo da feature, distribua em paralelo as frentes independentes que fizerem sentido, por exemplo:

- levantamento de requisitos, restrições, arquitetura e contratos existentes;
- pesquisa visual e levantamento de referências no Figma;
- inventário de dados, fontes, repositórios, serviços e integrações;
- avaliação de persistência, modelos e impactos de dados;
- diagnóstico da suíte de testes e preparação de cenários;
- inspeção de dependências, build, segurança, acessibilidade e SEO;
- avaliação de viabilidade de busca semântica, automações ou funcionalidades de IA.

Esses itens são exemplos de **frentes de trabalho**, não uma divisão fixa de cargos. O Maestro deve consultar as funções reais do Maestri e delegar cada frente ao agente adequado. A implementação que dependa de um contrato ainda indefinido deve aguardar esse contrato; a análise preliminar não precisa aguardar.

### 4.3 Não transforme o fluxo em uma fila serial

- Use a DAG, e não uma sequência fixa de agentes, para decidir a ordem.
- Faça fan-out: distribua tarefas independentes em uma única rodada de delegação.
- Faça fan-in incremental: assim que um agente entregar uma parte, avalie-a e encaminhe a próxima etapa dependente sem esperar os demais agentes terminarem.
- Se uma frente estiver bloqueada, continue todas as outras frentes não bloqueadas.
- Espere somente por dependências explícitas: contrato de API, decisão de produto, gate visual, migração necessária, integração ou evidência de teste.
- Se um agente estiver demorando ou bloqueado, peça um relatório parcial e redirecione tarefas independentes. Não deixe a equipe inteira ociosa.
- Registre bloqueios com: tarefa bloqueada, dependência exata, responsável pela dependência e trabalho alternativo que continuará.
- Não faça reuniões de sincronização desnecessárias. Use entregas escritas curtas e notas compartilhadas.

### 4.4 Contrato de delegação

Toda tarefa delegada deve informar ao agente:

- **Objetivo:** resultado verificável esperado.
- **Escopo:** o que deve e o que não deve ser alterado.
- **Responsável:** um único agente dono da entrega.
- **Arquivos/módulos:** área de propriedade do agente; não editar arquivos de outro agente sem combinar com o Maestro.
- **Dependências:** o que precisa estar pronto e o que pode avançar em paralelo.
- **Critérios de aceite:** como demonstrar que a tarefa terminou.
- **Verificação:** testes, comandos, checagens ou evidências exigidos.
- **Entrega:** arquivos alterados, decisões, riscos, testes executados e próximos passos.

O agente deve comunicar progresso quando houver uma descoberta relevante, bloqueio ou entrega parcial — não apenas ao final. Ao concluir, deve enviar um resumo objetivo e avisar o Maestro.

### 4.5 Concorrência segura

- Um único agente é o proprietário de cada arquivo durante uma rodada de implementação.
- Nunca instrua dois agentes a editar simultaneamente o mesmo arquivo, componente, migration, configuração ou contrato.
- Divida por módulos, componentes ou camadas independentes, não por pequenas alterações sobre o mesmo arquivo.
- Se o ambiente permitir worktrees/andares isolados, use-os para mudanças paralelas com risco de conflito. Caso contrário, defina propriedade exclusiva de arquivos e integre de forma controlada.
- Arquivos compartilhados — por exemplo `package.json`, arquivos de lock, rotas centrais, tokens globais e configurações — têm um único responsável por rodada.
- O Maestro coordena a integração e resolve conflitos; não descarte mudanças de outro agente sem inspeção.

### 4.6 Gates e dependências típicas

| Entrega | Pode começar em paralelo com | Deve aguardar antes de implementar |
|---|---|---|
| Pesquisa Figma | Inventário do backend, análise de dados, diagnóstico QA e auditoria inicial | Gate visual aprovado antes da implementação visual da tela correspondente. |
| Contratos e requisitos | Pesquisa Figma, inventário de dados, QA exploratório e revisão inicial | Decisões de produto necessárias e aprovação da especificação. |
| Catálogo/backend | Pesquisa Figma e análise de requisitos | Contrato de dados/API para integração final com frontend e IA. |
| Persistência local | Análise do backend, requisitos e QA | Decisão aprovada sobre o que persistir, por quanto tempo e em qual mecanismo. |
| Busca semântica | Pesquisa independente e análise de dados existentes | Contrato/campos do catálogo para indexação e integração real. |
| Frontend | Pesquisa visual, modelagem de dados e testes de contrato | Critérios de aceite e gate visual da tela; contrato de dados para integração real. |
| QA | Implementação e revisão de arquitetura, desde que os critérios estejam definidos | Build integrado para regressão final; não precisa esperar para preparar testes. |
| Revisão final | Preparação da suíte de testes e checagens de segurança | Diff integrado e evidências de teste para o parecer final. |

## 5. Gate de pesquisa visual no Figma

Para cada feature que crie ou altere uma tela relevante, o Maestro deve delegar a pesquisa visual ao agente cuja função cadastrada no Maestri cubra UI/UX e pesquisa de referências. Esse agente deve pesquisar **20 referências distintas no Figma** antes de iniciar a implementação visual.

A pesquisa deve:

1. Buscar referências relacionadas ao tipo de tela, fluxo, setor e padrão de interação necessários.
2. Registrar 20 referências reais e distintas, com nome, URL acessível, descrição do padrão observado e motivo da relevância.
3. Identificar padrões recorrentes e separar inspiração útil de elementos que não combinam com o produto.
4. Propor direção visual, hierarquia, layout, estados, responsividade e motion.
5. Traduzir a direção em tokens e componentes reutilizáveis, respeitando o design system existente.
6. Entregar um breve relatório ao Maestro para aprovação do gate antes da implementação visual.

**Não fabrique referências ou URLs.** Se o Figma, a busca ou as páginas não estiverem acessíveis, informe exatamente a limitação, apresente apenas referências verificáveis disponíveis e solicite ao Maestro a decisão sobre como prosseguir. Não declare o gate concluído com menos de 20 referências sem registrar a exceção e sua aprovação.

A pesquisa Figma é um gate para a implementação visual, **não um bloqueio para backend, banco de dados, inventário, arquitetura de dados, QA exploratório ou auditoria de segurança**.

## 6. Skill obrigatória: TLC Spec-Driven Development

Use a skill **`tlc-spec-driven`**, de Tech Lead's Club, como fluxo padrão para features, correções relevantes, mudanças de arquitetura que afetem comportamento e validações.

### 6.1 Ciclo

Siga as quatro fases adaptativas da skill:

1. **Specify:** requisitos claros, critérios de aceite testáveis, premissas, restrições e rastreabilidade.
2. **Design:** arquitetura e decisões técnicas quando a complexidade justificar.
3. **Tasks:** tarefas pequenas, dependências explícitas, agente responsável, testes e gates.
4. **Execute:** implementação, testes, evidências, commits e verificação independente.

Não crie arquivos vazios só para preencher estrutura. Deixe a skill dimensionar a profundidade conforme o tamanho da mudança. Para tarefas pequenas, use o fluxo enxuto previsto pela própria skill.

### 6.2 Aprovações e rastreabilidade

- Respeite os pontos de aprovação humana exigidos pela skill para a especificação e para o plano de tarefas.
- Não registre uma aprovação que o usuário não deu.
- Transforme decisões recebidas em registro persistente no arquivo apropriado.
- Cada critério de aceite deve ter uma checagem e cada checagem deve ter uma prova reproduzível.
- Testes devem validar o comportamento especificado, não apenas reproduzir a implementação feita.
- Nunca enfraqueça, remova ou pule testes para obter aprovação artificial.

### 6.3 Execução paralela usando a equipe Maestri

- O Maestro deve consultar as funções efetivamente cadastradas no Maestri e recrutar somente os agentes necessários, distribuindo frentes independentes conforme a seção 4.
- Use os agentes Maestri como mecanismo primário de divisão do trabalho. Não duplique suas descrições de função neste arquivo e evite criar subagentes aninhados dentro dos especialistas.
- A aprovação geral do usuário para delegação aos agentes já configurados no Maestri está dada; não peça confirmação a cada recrutamento rotineiro desses papéis.
- Continue respeitando as aprovações de especificação e tarefas da TLC, bem como a confirmação explícita para ações externas, destrutivas ou irreversíveis.
- A verificação final deve ser feita por um agente diferente do autor da implementação. Selecione no Maestri uma função adequada à verificação independente, sem presumir nomes ou cargos fixos.

### 6.4 Memória da execução

Quando a skill estiver instalada, mantenha a estrutura `.specs/` definida por ela, incluindo `STATE.md`, decisões, handoff e artefatos da feature. Consulte o estado e as decisões antes de retomar uma tarefa. Não edite manualmente arquivos que a skill identifica como gerados/gerenciados por scripts.

Execute os validadores e scripts fornecidos pela skill usando o caminho real da instalação dela, nunca presumindo que estejam em `./scripts` na raiz do projeto. Se um validador falhar, corrija a causa antes de avançar.

## 7. Skill obrigatória: Graphify para compreender o projeto

Use **Graphify** sempre que a tarefa exigir entender a arquitetura existente, fluxo entre módulos, dependências, chamadas, imports, componentes compartilhados, modelos de dados, APIs ou impacto transversal de uma mudança.

### 7.1 Quando consultar

- Ao entrar em um projeto desconhecido ou retomar um projeto sem contexto suficiente.
- Antes de propor mudanças em módulos existentes ou arquitetura.
- Antes de alterar código compartilhado ou fluxo que atravesse frontend, backend, banco ou agentes de IA.
- Durante debugging de problemas que envolvam várias camadas.
- Em revisão de impacto e análise de regressões.

### 7.2 Como usar

- Se o grafo não existir, estiver desatualizado ou não representar a versão atual do código, use a skill `/graphify .` para gerar/atualizar o mapa conforme a documentação instalada.
- Para perguntas específicas, prefira consultas focadas como `graphify query "<pergunta sobre o projeto>"`.
- Use `graphify path "<origem>" "<destino>"` para rastrear a conexão entre dois componentes/conceitos.
- Use `graphify explain "<conceito>"` para entender um nó e suas relações.
- Consulte `GRAPH_REPORT.md` para uma visão geral e `graph.json` para evidência estruturada, sem ler o projeto inteiro indiscriminadamente.
- Diferencie relações `EXTRACTED` (presentes explicitamente no código/documentos) de `INFERRED` (inferidas pelo Graphify). Confirme relações inferidas no código antes de tomar decisões importantes.
- Depois de mudanças estruturais relevantes, atualize o grafo antes de usá-lo como evidência para uma nova análise.

Graphify complementa — não substitui — leitura do código, testes, documentação e validação. Se a skill/CLI não estiver instalada ou o grafo não puder ser consultado, informe a limitação e use navegação direcionada pelo código. Nunca finja ter consultado o grafo.

## 8. Dados, privacidade e segurança

- Trate dados de contato como potencialmente pessoais. Colete apenas o necessário e não exponha mensagens em logs, analytics ou interfaces públicas.
- Não coloque tokens, senhas, chaves, `.env`, credenciais ou dados pessoais em commits, notas compartilhadas ou relatórios.
- Não adicione telemetria, analytics, dependências ou chamadas externas fora do escopo aprovado.
- Não afirme que uma mensagem foi enviada se não houver confirmação real do serviço responsável.
- Use dados públicos de projetos apenas quando houver fonte verificável e permissão de uso.
- Não faça ações irreversíveis, deploy, publicação, push remoto, alteração de banco de produção ou exclusão de arquivos/dados sem autorização explícita.

## 9. Git e commits atômicos por feature

O histórico Git deve deixar claro o que foi entregue. **Features diferentes nunca devem ser agrupadas em um único commit genérico.**

1. Antes de editar, verifique branch, `git status` e commits recentes. Preserve todas as alterações preexistentes do usuário e dos outros agentes.
2. Delimite o escopo do diff. Não inclua arquivos não relacionados, artefatos temporários, segredos ou alterações de outro agente.
3. Execute os testes e gates aplicáveis à tarefa/feature. Um commit só pode ser criado depois de os testes aplicáveis passarem ou de uma limitação estar explicitamente documentada e aprovada.
4. Siga a granularidade de commits exigida pela `tlc-spec-driven`: cada tarefa concluída recebe seu commit atômico. Não misture tarefas ou features independentes.
5. Cada feature entregue deve ter seu próprio commit descritivo. Se a skill dividir uma feature em tarefas atômicas, os commits permanecem separados e vinculados à mesma feature; nunca reúna features distintas.
6. Use Conventional Commits, com escopo curto e descritivo. Exemplos:
   - `feat(hero): implementa seção principal responsiva`
   - `feat(projects): adiciona catálogo de projetos verificados`
   - `feat(search): implementa busca semântica de projetos`
   - `fix(contact): corrige validação do formulário`
   - `test(projects): adiciona testes de filtros e navegação`
   - `refactor(ui): centraliza tokens de interface`
   - `docs(architecture): documenta contratos de dados`
7. No workspace compartilhado, apenas o Maestro deve coordenar o `git add`/`git commit` para evitar incluir mudanças concorrentes. Em worktree isolada, o agente dono da tarefa pode criar o commit após seus testes e reportar o hash.
8. Antes do commit, confira novamente o diff e os arquivos staged. Nunca use `git add .` sem revisar o que será incluído.
9. Após o commit, informe hash, mensagem, testes executados e resultado.
10. Não faça `push`, force-push, merge remoto ou deploy sem solicitação/autorização explícita.

## 10. Critérios de conclusão (Definition of Done)

Uma tarefa/feature só está concluída quando:

- Os critérios de aceite aprovados foram atendidos.
- O código respeita os contratos e padrões existentes.
- Os testes aplicáveis foram executados e passaram; falhas ou limitações estão documentadas.
- A revisão independente foi concluída quando exigida.
- Acessibilidade, responsividade, segurança e SEO foram verificados conforme o escopo.
- A documentação, especificação, estado e handoff foram atualizados quando necessário.
- O diff está limitado à entrega e o commit atômico correspondente foi criado.
- Não há bloqueios ou riscos críticos ocultos.

## 11. Formato obrigatório de relatório dos agentes

Ao devolver uma tarefa ao Maestro, use este formato compacto:

```text
STATUS: concluído | parcial | bloqueado
AGENTE MAESTRI: <identificador/nome do agente que recebeu a tarefa>
ENTREGA: <o que foi feito>
ARQUIVOS: <arquivos criados/alterados>
DECISÕES: <decisões e justificativas>
DEPENDÊNCIAS/BLOQUEIOS: <nenhum ou descrição objetiva>
TESTES: <comandos executados e resultado>
EVIDÊNCIAS: <logs, saídas, screenshots ou referências relevantes>
COMMIT: <hash e mensagem, ou não aplicável>
PRÓXIMO PASSO: <ação recomendada e responsável>
```

## 12. Verificação disponível e pré-requisitos locais

- Backend: em `backend/`, criar ambiente Python 3.11, instalar `requirements-dev.txt`, executar `python -m pytest -q` e iniciar com `uvicorn main:app --host 127.0.0.1 --port 8000 --reload`.
- Frontend: em `frontend/`, usar `npm ci`, `npm run dev`, `npm run lint`, `npm run build` e `npm audit --audit-level=moderate`.
- Navegação: com `backend/.venv` instalado e portas 8000/3000 livres, em `frontend/` executar `npx playwright install --only-shell chromium` e `npm run test:e2e` (Node 22+). Usa apenas o modo demo e inicia os dois servidores.
- A suíte Playwright automatiza a seleção de artistas e conexões pela lista acessível, a troca entre grafos, o limiar e o layout móvel no modo demo. O toque direto em linhas específicas do Canvas ainda exige validação manual porque as posições do layout de forças variam. Registre as verificações de navegador realmente executadas.
