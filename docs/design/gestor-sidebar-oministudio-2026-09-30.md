# Correção do sidebar do gestor e acesso ao OmniStudio

Data: 30/09/2026.

## Alterações

- O sidebar do gestor possui rolagem vertical própria e não prende os itens inferiores fora da tela; a barra nativa fica oculta para preservar o visual limpo.
- O botão de recolher/fechar fica preso à borda externa do sidebar, inclusive em tablet, sem acompanhar a área rolável.
- Ao recolher no desktop, o menu inteiro sai da área visível. Somente o botão de reabrir permanece.
- O conteúdo principal recupera imediatamente toda a largura disponível.
- O breakpoint do controle do menu foi alinhado ao layout em 900 px.
- Todos os HTMLs do gestor receberam uma versão nova dos arquivos compartilhados para evitar CSS/JS antigo em cache.
- O link do professor para o OmniStudio agora é construído a partir da origem do site: `/engine/dist/client/index.html`.
- A Netlify passa a publicar a raiz completa, executar o build da engine e aceitar também `/oministudio` e `/oministudio/*`.

## Validação

Em tablet (768 × 800), o menu apresentou 839 px de conteúdo dentro de 800 px disponíveis. A rolagem chegou a `39,2 px`, sem barra nativa visível. O controle ocupou `281–319 px` sobre a borda de `300 px`, comprovando a ancoragem centralizada. Recolhido no desktop, o menu ficou totalmente fora do viewport e somente o controle lateral de reabertura permaneceu.

O build de produção do OmniStudio foi concluído e a rota final carregou a tela `#choose`, os recursos visuais e o link de retorno ao painel. Gestor e engine não emitiram erros de console no teste final.

Testes automatizados:

```text
node --test tests/navigation-shell.test.mjs
npm --prefix engine run test:sites
npm --prefix engine run build
```

O funcionamento no domínio público depende de um novo deploy da Netlify contendo `netlify.toml`, o build atualizado e os arquivos do frontend.
