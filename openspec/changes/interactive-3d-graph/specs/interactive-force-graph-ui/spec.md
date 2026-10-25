# Delta Spec: Interactive 3D Music Graph

## ADDED Requirements

### Requirement: Real 3D Graph Rendering

O frontend MUST renderizar nós e arestas em um espaço 3D com profundidade e câmera 3D. A implementação MUST consumir o contrato de dados existente (`metadata`, `nodes`, `links`) sem alterar a semântica das métricas topológicas.

#### Scenario: Renderizar o modo Artistas ↔ Artistas

- **GIVEN** que o backend retorna um payload válido no modo `artists`
- **WHEN** a visualização termina de carregar
- **THEN** artistas e ligações são exibidos em espaço 3D, com cor de comunidade e informação identificável para cada artista

#### Scenario: Renderizar o modo Artistas ↔ Gêneros

- **GIVEN** que o backend retorna nós `artist` e `genre` no modo `bipartite`
- **WHEN** a visualização termina de carregar
- **THEN** artistas e gêneros são visualmente distintos e as arestas preservam o relacionamento artista-gênero

### Requirement: Camera Navigation and Zoom

A visualização MUST permitir rotação/orbit da câmera, aproximação/afastamento (zoom), pan, enquadramento de todos os nós visíveis e restauração da posição inicial da câmera. Os limites de zoom MUST impedir que seja impossível recuperar o grafo por interação comum.

#### Scenario: Aproximar um cluster

- **GIVEN** que o grafo está renderizado
- **WHEN** o usuário usa a roda do mouse ou gesto de pinça compatível
- **THEN** a câmera se aproxima/afasta sem disparar uma navegação da página e sem alterar os dados do grafo

#### Scenario: Restaurar enquadramento

- **GIVEN** que o usuário moveu ou aproximou a câmera
- **WHEN** ativa o controle "Enquadrar grafo" ou "Resetar visão"
- **THEN** a câmera enquadra os nós visíveis ou retorna à visão inicial, respectivamente

### Requirement: Preserve Current Graph Interactions

A visualização MUST preservar os filtros de período, modo e peso mínimo de aresta, a seleção de nó, o destaque da vizinhança imediata, a opacidade dos elementos não relacionados e o painel analítico.

#### Scenario: Filtrar arestas em 3D

- **GIVEN** que há arestas com pesos diferentes
- **WHEN** o usuário aumenta o limiar mínimo
- **THEN** arestas abaixo do limiar deixam de ser exibidas sem recarregar a página nem perder o nó selecionado se ele continuar válido

### Requirement: Accessible Graph Inspection

A interface MUST fornecer nomes/controles compreensíveis, foco visível e uma forma alternativa de consultar os detalhes dos nós sem depender exclusivamente de hover, cor ou gestos 3D. Deve respeitar `prefers-reduced-motion` para animações não essenciais.

#### Scenario: Inspecionar nó sem hover

- **GIVEN** um usuário que navega com teclado ou não consegue realizar gestos de câmera
- **WHEN** utiliza a lista/controles acessíveis de nós ou o foco de teclado disponível
- **THEN** consegue abrir os detalhes do nó e identificar os seus metadados principais

### Requirement: WebGL Failure and Loading States

A interface MUST distinguir carregamento, falha da API, payload vazio e indisponibilidade de WebGL, mantendo o modo demo disponível quando não forem necessárias credenciais reais.

#### Scenario: WebGL indisponível

- **GIVEN** que o navegador não consegue iniciar o contexto WebGL
- **WHEN** o componente de grafo tenta inicializar
- **THEN** a interface mostra uma mensagem clara e oferece acesso aos metadados/alternativa de inspeção sem entrar em loop de erro
