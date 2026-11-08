# Política de segurança

O BeatCode está em desenvolvimento e foi projetado para execução **local**, com os servidores limitados a `127.0.0.1`. Não há versão publicada para implantação multiusuário, nem calendário de releases ou prazo de resposta formal. O armazenamento de sessões e tokens é em memória de um único processo; antes de expor a aplicação à internet, essa arquitetura precisa de revisão.

## Como relatar uma vulnerabilidade

Não publique credenciais, dados pessoais, passos de exploração ou provas de conceito em issues ou pull requests públicos. **Ainda não há um canal privado de contato confirmado pelos mantenedores.** Se a opção **“Report a vulnerability”** estiver disponível na aba Security deste repositório, use-a; caso contrário, abra uma issue **sem detalhes sensíveis** pedindo aos mantenedores um canal privado. Esta política deverá ser atualizada quando esse canal for definido.

Se encontrar um segredo utilizável no repositório, informe os mantenedores com urgência por um canal privado assim que disponível: revogação ou rotação vem antes de qualquer discussão sobre limpeza do histórico. Remover um arquivo de um commit futuro não o apaga do histórico Git.

## Escopo de suporte

Relatos sobre o código atual são bem-vindos, incluindo OAuth, isolamento entre navegadores, CORS, dependências e exposição de dados musicais. Releases antigas e configurações de implantação pública não têm suporte declarado. Testes de autenticação do projeto usam mocks; credenciais Spotify reais não são necessárias para reproduzir a maioria dos problemas.

Consulte a [arquitetura](docs/arquitetura.md#segurança-e-limite-de-implantação) para as limitações operacionais e o [guia de contribuição](CONTRIBUTING.md#dados-segredos-e-segurança) para evitar vazamentos em PRs.
