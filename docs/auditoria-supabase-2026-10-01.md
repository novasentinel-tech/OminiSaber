# Auditoria do Supabase — 01/10/2026

## Escopo

Validação do projeto remoto configurado no `.env` principal, cobrindo disponibilidade dos serviços, autenticação, login por matrícula, isolamento por RLS, integridade dos dados acadêmicos, persistência do OminiStudio e permissões dos fluxos de resultados.

Nenhuma avaliação, tentativa, resposta ou dado real de usuário foi alterado. Os usuários sintéticos usados nos testes foram removidos automaticamente ao final de cada cenário.

## Resultados remotos

- Auth, Data API e Storage responderam normalmente.
- Cadastro administrativo temporário: aprovado.
- Login por e-mail: aprovado.
- Login por matrícula: aprovado.
- Criação automática do perfil protegido: aprovada.
- Acesso anônimo a perfis: zero linhas.
- Acesso anônimo a tentativas, auditoria e tabelas do OminiStudio: bloqueado.
- Aluno autenticado: enxerga somente o próprio perfil.
- Aluno autenticado: não enxerga a auditoria de avaliações.
- RPC de ajuste de nota: executável por professor; não ocorreu `permission denied`.
- RPC de criação de recuperação: executável por professor; não ocorreu `permission denied`.

## Integridade observada

| Conjunto | Quantidade |
|---|---:|
| Perfis | 9 |
| Vínculos docentes canônicos | 5 |
| Avaliações | 6 |
| Questões | 14 |
| Tentativas | 9 |
| Respostas | 29 |
| Notificações | 8 |
| Experiências do OminiStudio | 1 |
| Versões publicadas do OminiStudio | 0 |
| Vínculos de turma do OminiStudio | 0 |

Não foram encontrados alunos sem turma/curso, professores sem especialidade/vínculo, avaliações publicadas sem questões, divergências de pontuação, tentativas entregues sem respostas, correções sem nota ou publicações sem notificação.

A experiência existente no OminiStudio permanece como rascunho, portanto não possuir versão publicada nem turma vinculada é um estado válido.

## Correções locais realizadas

- `@supabase/supabase-js` foi fixado em `2.112.3`, igual ao cliente empacotado no frontend.
- A migração `20260928_corrigir_recuperacao_ajuste_nota.sql` foi incorporada ao schema consolidado.
- O schema completo foi regenerado.
- Validadores antigos do painel do aluno foram alinhados ao carregamento atual por `getStudentDashboard()`.
- O validador do OminiStudio passou a conferir o cliente local empacotado, sem CDN.

## Verificações locais

- Governança: 86 tabelas públicas e 86 com RLS; nenhuma falha.
- OminiStudio/Supabase: 18/18 verificações aprovadas.
- Fluxo de atividade do aluno: todas as verificações aprovadas.
- Revisão docente: aprovada.
- Resultados, ajuste de nota e recuperação: aprovados.
- Documentação: 119 arquivos verificados, sem segredos detectados.

## Observações de ambiente

O `.env.phase3` referencia um projeto diferente do `.env` principal e não possui chaves privadas. Ele não foi usado nesta auditoria. O empacotamento atual usa a configuração gerada a partir do `.env` principal.

Os arquivos `.env` continuam protegidos pelo `.gitignore`. Chaves `secret` e `service_role` não devem ser publicadas no GitHub ou no Netlify; somente a chave pública pode chegar ao navegador.

No computador de desenvolvimento, o `fetch` do Node foi bloqueado pela camada TLS local, embora os serviços remotos estivessem saudáveis. As verificações remotas foram concluídas pela mesma API HTTPS usando o transporte nativo do Windows. Isso não indica indisponibilidade do Supabase.
