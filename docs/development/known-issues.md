# Problemas conhecidos e riscos acompanhados

Atualizado em **25 de setembro de 2026**.

## Segurança

- `email_por_matricula(text)` continua disponível antes da autenticação para o
  login por matrícula. Revisar enumeração, mensagens e limitação de tentativas antes
  da produção.
- O advisor ainda aponta funções `SECURITY DEFINER` herdadas. Auditar grants,
  `search_path` e checagem de papel gradualmente.
- A biblioteca precisa ampliar testes negativos de RLS; o verificador atual não é
  evidência suficiente para declarar toda a superfície validada.
- A proteção contra senhas vazadas está desativada no Supabase Auth.
- O frontend carrega `@supabase/supabase-js@2` sem versão exata no CDN.
- A migration `20260925090000_organizacao_governanca_banco.sql` passou nas
  validações locais, mas ainda não foi aplicada ao projeto remoto por falta de uma
  conexão PostgreSQL ou token da Management API autorizado para DDL.
- A auditoria remota em Node apresenta falhas de transporte intermitentes no
  ambiente com proxy; a Data API e a chave administrativa foram validadas por uma
  requisição independente.

Resolvidos em 9 de setembro de 2026:

- correções de redação agora exigem cinco competências e nota coerente;
- o verificador da biblioteca agora falha quando o fluxo integrado não é exercitado.
- turma, curso e especialidade no gestor são atualizados em uma única operação;
- os redirecionamentos legados possuem viewport e fallback navegável;
- o cliente discente morto com rotas desatualizadas foi removido;
- a entrada raiz possui documento semântico e alternativa ao redirecionamento.

## Fase 3

- não existe ambiente remoto ativo para o Copiloto;
- `GEMINI_API_KEY` deve ficar somente nos secrets da Edge Function;
- a primeira liberação deve usar `feature_flag_usuarios` para contas específicas.

## Operação e manutenção

- O frontend não possui bundler; caminhos relativos precisam ser validados ao mover
  páginas.
- Há arquivos históricos e scaffolds preservados. `docs/legacy/` não é contrato
  atual; páginas `code.html` mantidas funcionam apenas como redirecionamentos
  compatíveis.
- Alertas de índices “não usados” em banco recém-criado podem refletir falta de
  tráfego. Colete uso real antes de remover índices.
- A medição de 9 de setembro apontava 18 chaves estrangeiras sem índice, 17
  policies com avaliação de autenticação por linha e 29 tabelas com policies
  permissivas sobrepostas. A migration de governança cobre índices de FKs, mas o
  resultado remoto deve ser medido novamente após a promoção.

## Cobertura atual

- O ambiente configurado possui somente um professor e três alunos. Não há perfil
  de gestor nem bibliotecária.
- O acervo físico está vazio, portanto solicitação, separação, entrega e devolução
  ainda não foram testadas ponta a ponta.
- Consulte a [auditoria geral](auditoria-sistema-2026-09-09.md) para IDs, evidências
  e ordem de correção.

## Processo

Ao resolver um item, atualize este arquivo, o módulo correspondente e os
verificadores. Não esconda um problema de leitura com dados mockados e não desligue
RLS para fazer uma tela funcionar.
