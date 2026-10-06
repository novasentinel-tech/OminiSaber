# Integração com Flourish

## Estratégia adotada

O professor cria a visualização no Flourish e cola no OminiStudio o link público da história ou visualização. A engine converte o endereço público em um `iframe` isolado.

Formatos aceitos nesta fase:

- `https://public.flourish.studio/visualisation/123456/`
- `https://public.flourish.studio/story/123456/`
- os equivalentes públicos em `flo.uri.sh`.

## Segurança

- somente HTTPS;
- somente hosts públicos conhecidos do Flourish;
- nenhum HTML arbitrário fornecido pelo professor;
- o conteúdo é isolado em `iframe`;
- a publicação futura deverá revalidar a URL no servidor.

## Acessibilidade

Todo bloco Flourish exige um resumo textual. O resumo deve explicar o principal padrão, dado ou conclusão da visualização e permanecer disponível quando o embed não carregar.

## Limite desta fase

A criação e a edição do gráfico continuam no Flourish. O OminiStudio incorpora, organiza no fluxo e apresenta a alternativa textual. A integração autenticada com uma conta Flourish poderá ser estudada depois, sem ser requisito para a publicação inicial da engine.

