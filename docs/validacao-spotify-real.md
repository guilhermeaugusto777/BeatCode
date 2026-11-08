# Validação local com uma conta Spotify

Este roteiro é manual. Não usa credenciais na CI e não pede que você compartilhe segredos, cookies, tokens, capturas da URL de callback ou arquivos HAR. Execute-o somente na sua máquina, com uma conta que você controla.

## Antes de começar

1. Crie ou abra seu aplicativo no [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Em modo de desenvolvimento, o proprietário precisa ter Spotify Premium e a conta de teste precisa estar na lista de usuários permitidos. Consulte as [regras atuais de quota](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).
2. Cadastre exatamente `http://127.0.0.1:8000/auth/callback` como Redirect URI. O Spotify exige correspondência com a URI usada pela aplicação e não aceita `localhost` para callbacks locais; consulte a [regra de redirect](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).
3. Copie `backend/.env.example` para `backend/.env` e edite **somente o arquivo local**. Preencha `SPOTIPY_CLIENT_ID` e `SPOTIPY_CLIENT_SECRET`; mantenha `SPOTIPY_REDIRECT_URI=http://127.0.0.1:8000/auth/callback` e `FRONTEND_URL=http://127.0.0.1:3000`. Não cole os valores em comandos, issues, mensagens ou logs. O `.env` está ignorado pelo Git.
4. Siga os comandos de [instalação e inicialização do README](../README.md#instalação-local). Inicie um único processo da API e deixe-o ativo durante todo o teste: as sessões são guardadas apenas na memória desse processo. Use `127.0.0.1` em ambos os serviços.

## Fluxo principal

1. Abra `http://127.0.0.1:3000` no perfil de navegador **A**. Antes do login, `/auth/status` deve indicar `authenticated: false` e `/api/graph?demo=false` deve responder **401**. O modo demonstração deve continuar disponível.
2. Escolha **Conectar minha conta Spotify**, confira no consentimento os escopos `user-top-read`, `user-read-recently-played` e `user-library-read`, e autorize. O retorno deve abrir novamente a interface do BeatCode. Não copie nem compartilhe a URL intermediária de callback.
3. Confira que o grafo **Artistas ↔ Artistas** carrega dados da sua conta, sem mensagem de erro. Selecione um artista e uma conexão; verifique que os nomes fazem sentido para os seus dados.
4. Alterne para **Artistas ↔ Gêneros (Bipartido)** e verifique nós de artistas e gêneros. Uma conta com poucos gêneros pode produzir um grafo pequeno; isso não implica falha de autenticação.
5. Alterne entre **4 Semanas**, **6 Meses** e **Histórico**. Observe a mudança dos artistas principais e dos dois grafos. Esses períodos se aplicam aos endpoints de itens principais do Spotify; o histórico recente e as faixas salvas são consultados separadamente e não obedecem ao seletor de período.
6. Se houver erro, anote apenas o código HTTP e a mensagem genérica exibida, sem exportar requisições ou respostas. **401** pede novo login; **403** pode indicar conta fora da lista de acesso ou escopo insuficiente; **429** indica limite de taxa ou quota; **5xx** pode ser indisponibilidade temporária. Aguarde o intervalo indicado pelo serviço antes de repetir uma solicitação limitada.

## Renovação, saída e isolamento

1. Após carregar um grafo real, deixe a API em execução e aguarde **mais de uma hora**, sem fazer logout. Recarregue a página e consulte novamente os dois grafos. Se os dados continuarem disponíveis sem nova autorização, a renovação do access token foi observada na prática. Um teste feito antes da expiração não valida a renovação. Não inspecione nem registre o valor do token.
2. Abra um perfil de navegador **B**, sem reutilizar cookies do A. No B, `/auth/status` deve indicar `authenticated: false` e `/api/graph?demo=false` deve responder **401**, mesmo enquanto A está conectado. A demonstração continua acessível. Isso verifica isolamento entre um perfil autenticado e outro anônimo; provar isolamento entre duas contas diferentes requer uma segunda conta autorizada e um teste separado.
3. No perfil A, clique em **Sair**. Em seguida, `/auth/status` deve indicar `authenticated: false`, e a API privada deve responder **401**. O logout invalida a sessão local; não revoga a autorização do aplicativo no Spotify.

## Limites da validação

- Os endpoints [top artists/tracks](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks), [recently played](https://developer.spotify.com/documentation/web-api/reference/get-recently-played) e [saved tracks](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks) continuam documentados com os escopos usados pelo backend. Um teste manual é necessário para confirmar o comportamento da conta e do aplicativo específicos.
- No modo de desenvolvimento atual, o Spotify removeu o campo `popularity` das respostas de artistas. O backend usa `50` quando esse campo não vem; portanto, `global_popularity` nesse caso **não é uma medida fornecida pelo Spotify** e não deve ser validada como tal. Consulte o [guia de migração de fevereiro de 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide). Corrigir a apresentação desse campo exige uma mudança de produto separada.
- O Spotify informa access tokens com cerca de uma hora de validade e refresh tokens com validade de seis meses; renovar o access token não prolonga o refresh token. Este roteiro verifica a renovação de curto prazo, não a reautorização após seis meses. Consulte a [documentação de renovação](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens).
