# Rework do Copiloto — opção 2

Verificação concluída em 4 de outubro de 2026.

## Entrega local

- Conversa e proposta lado a lado, com contexto da atividade, versões e edição direta.
- Atividades, ideias e trilhas completas; revisão de uma etapa preserva as demais.
- Prévia do aluno com respostas, feedback e separação dos gabaritos privados.
- Aplicação ao rascunho, adição de questões e restauração/reaplicação explícitas.
- Percursos chegam ao aluno com objetivos, instruções, conexões e ordem das etapas.
- Rascunhos podem ser preparados e salvos sem currículo; a exigência existente continua na publicação da base comum.
- Contexto analítico permanece desativado por padrão e, quando autorizado, usa indicadores agregados.
- Gabaritos numéricos e pontos em centavos têm o mesmo contrato entre a prévia, o editor e a função da IA.

## Evidências visuais

- [Referência escolhida](referencia-opcao-2.png).
- [Implementação desktop](desktop-previa.jpg), [comparação completa](comparacao-desktop.jpg), [conversa](comparacao-conversa.jpg) e [prévia](comparacao-previa.jpg).
- [Conversa no celular](mobile-conversa.jpg), [resposta e feedback](mobile-previa.jpg), [ações finais](mobile-acoes.jpg) e [tablet](tablet.jpg).
- [Tratamento do erro do servidor](erro-servidor.jpg), reproduzido em teste isolado.
- [Portal autenticado real](portal-real.jpg), após recarregar os assets finais e restaurar o tamanho padrão do navegador.

A referência tem 1487 × 1058 pixels. A implementação foi conferida em viewport de 1487 × 1058 CSS pixels. O navegador exporta a área útil em 1472 × 1048 pixels, excluindo partes de sua moldura e barra de rolagem. A prancha mantém escala comum e completa a área restante com fundo; nenhuma região foi esticada para aparentar correspondência.

O fluxo simulado usa os arquivos de produção e dados inventados em `/tests/copilot-workspace.html`. O aviso na tela identifica que IA e publicação são simuladas. As capturas não representam uma geração real aprovada do provedor.

## Verificação funcional

147 testes automatizados únicos passaram: 105 de regressão e integração local dos componentes, 22 do contrato da interface e 20 do backend da IA. As duas suítes de renderização matemática precisaram de leitura ampliada das dependências locais no Windows; suas nove verificações passaram. Não foi alterada a implementação matemática para contornar esse ambiente.

O navegador executou 42 verificações da fixture `copilot-handoff-browser.html?test=1`, cobrindo rascunho sem currículo, percurso completo, orçamento, aplicação atômica, rollback, desfazer/reaplicar, publicação sem vínculo bloqueada, payload público, resposta do aluno e progresso. O salvamento usa uma API inventada: nenhuma avaliação foi publicada externamente.

Também foram conferidos no navegador:

- ideia → atividade, inclusive a liberação do botão após a geração;
- edição inválida bloqueando a aplicação;
- refinamento com versões e manutenção das alterações do professor;
- revisão da etapa intermediária preservando as outras duas;
- resposta objetiva e feedback, sem exibir o gabarito privado da questão aberta;
- erro transitório, nova tentativa e sucesso posterior;
- saída inválida recusada;
- troca de turma durante um pedido lento, descartando a resposta antiga;
- envio por Ctrl+Enter, troca de abas pelas setas, Escape e reabertura preservando a proposta;
- layouts desktop, tablet em 768 × 1024 e celular em 390 × 844, sem transbordamento horizontal;
- botões de resposta e ações principais com pelo menos 44 pixels no celular;
- ação de aplicar acima da navegação móvel fixa, sem sobreposição.

Não houve erros de console nas fixtures finais. Sintaxe, documentação, construtor, execução do aluno, correção, resultados e governança estática passaram. O schema consolidado contém 86 tabelas públicas, todas com RLS.

## Limites da validação

A migration incremental teve suas seis instruções analisadas pelo parser PostgreSQL, e o schema completo passou pela validação estática. O teste de execução PostgreSQL em PGlite foi mantido sem dispensas, mas não inicializou o WASM por falta de memória local. Não se afirma que essa execução passou.

O portal autenticado real carregou a nova interface. Uma solicitação pedagógica com texto fictício, sem panorama da turma, recebeu do servidor `Request contains an invalid argument.` Nenhuma sugestão foi aplicada ou publicada nessa sessão. A interface agora traduz esse erro para uma orientação em português, preserva o pedido e evita oferecer repetição automática para uma falha de configuração.

Não há ferramenta administrativa de Supabase nem CLI disponível nesta sessão para publicar os novos arquivos. A migração e a Edge Function **ainda precisam ser implantadas** e a geração real precisa ser validada depois disso. O provedor, o modelo configurado, os secrets, a autenticação e as permissões remotas não foram alterados.

## Arquivos para ativar a atualização

1. Aplicar `backend/migrations/20261003_copiloto_ideias_trilhas.sql` no ambiente correspondente, após a execução do teste SQL.
2. Publicar `backend/supabase/functions/professor-copiloto/index.ts` com `pedagogical-contract.ts`, mantendo os secrets e o controle de acesso existentes.
3. Validar geração real de atividade, ideias, trilha e revisão da etapa ativa, com indicadores agregados desativados.
4. Usar o pacote público atualizado em `netlify-dist/` para o frontend. Ele foi preparado localmente e não foi publicado nesta tarefa.

O pacote contém apenas o site, os arquivos públicos de conexão e a versão compilada do OmniStudio. Fixtures, documentação, testes, migrations e arquivos privados ficam fora dele.


## Atualização posterior — integração concluída em 4 de outubro de 2026

Os limites de implantação descritos acima foram resolvidos em uma sessão posterior: a migration incremental e os cinco arquivos da Edge Function foram publicados no projeto real. Atividade, trilha e ideias concluíram e apareceram na interface. O reforço pedagógico final também foi publicado e uma nova trilha confirmou resposta curta inequívoca, material novo na transferência e revisão humana de justificativas. O pacote público `netlify-dist/` foi atualizado com o novo dashboard e o Copiloto. O frontend permanece preparado localmente; a implantação remota confirmada refere-se ao servidor de IA. Consulte [o registro final](../dashboard-rework-2026-10-04/ai-integration.md) para as evidências e os limites de teste.
