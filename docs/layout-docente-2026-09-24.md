# Renovação visual docente

Fonte compartilhada: `frontend/Parties/layouts/teacher-workspace.css`. Bundle gerado por `frontend/Parties/migrate-html.mjs`, versão 20260924-3.

## Auditoria em andamento

O [plano e registro de bugs](auditoria-docente-2026-09-24/PLANO-E-RESULTADOS.md) reúne as 17 rotas, matriz de dispositivos, prioridades, evidências e pendências. Nesta rodada foram corrigidos fechamento e reset do modal de nota, alvo de toque/nome acessível da janela e rótulos das etapas no mobile. A suíte isolada agora tem 16 verificações aprovadas. A validação autenticada continua pendente.

## Alterações

Menu lateral branco com seleção azul clara, cabeçalho contextual, botões de 44px ou mais, cartões com borda leve, espaçamento consistente, tipografia compartilhada e formulários com texto de 16px. Grids complexos passam para uma coluna em tablet/celular. Linhas de resultados passam a cartões com identificação dos valores automático, manual e final. Ações da criação não ficam presas atrás da navegação inferior.

`Parties/parties.js` reconhece `.portal-sidebar` e monta a navegação inferior docente: Início, Avaliações, Aulas, Agenda e Mais. Menu móvel com animação, fechamento, Escape, contenção de foco e fundo inerte. Comportamento restrito ao papel visual docente; autorização não foi modificada.

## Verificação

- Prévia isolada com markup docente em desktop e larguras de 390 e 768px.
- Sem overflow horizontal: 371/371px no celular e 749/749px no tablet, descontadas barras de rolagem.
- Abertura do menu, alinhamento final, fechamento por Escape e retorno de foco ao botão verificados no navegador.
- Doze testes locais da central de avaliações aprovados com o novo CSS.
- Prévia ilustrativa temporária removida da área de produção após os testes.
- Não houve publicação no Netlify, alterações de notas ou de permissões.

A verificação autenticada de todas as páginas docentes ainda depende de uma sessão de professor. A sessão disponível na tarefa é de aluno e não autoriza acesso aos dados docentes.
