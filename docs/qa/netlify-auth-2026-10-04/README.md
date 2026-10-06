# Verificação de autenticação — 4 de outubro de 2026

Projeto de testes: `mvnuhwlnbhijjlosmnfv.supabase.co`.

## Causa confirmada

A configuração pública do frontend e da pasta `netlify-dist` usa o mesmo
projeto e a mesma chave pública configurados no ambiente de desenvolvimento.
O problema das contas de aluno estava nos registros remotos, e não na ausência
de arquivos privados no pacote de publicação.

A API de autenticação listava somente seis usuários profissionais. As 30
linhas de aluno existiam em `auth.users`, ligadas aos mesmos perfis da turma
`d2400000-0000-4000-8000-000000000001`, mas tinham `instance_id` nulo. Os quatro
campos `confirmation_token`, `recovery_token`, `email_change_token_new` e
`email_change` também estavam nulos em toda a coorte; o serviço de autenticação
exige texto nesses campos. As nove primeiras contas tinham endereços como
`aluno 1@teste.ominisaber.com`, incompatíveis com os acessos documentados.

No exemplo do professor, o identificador `profportugues` não correspondia à
matrícula existente `userprofportugues`. O e-mail e a senha documentados do
professor autenticavam corretamente antes da correção dos alunos.

## Correção aplicada

O agente principal confirmou as linhas SQL e os campos nulos antes de alterar
os dados. A atualização de instância e dos quatro campos internos foi restrita
à coorte de 30 alunos sintéticos existentes. A igualdade dos hashes com a senha
documentada foi confirmada somente como uma contagem de resultados, sem exibir
hashes.

O script `repair-student-test-auth-emails.js` fez primeiro uma execução de
conferência: 30 identidades confirmadas, nove e-mails de autenticação
malformados e nove contatos malformados. A execução com `--apply` corrigiu
somente esses nove endereços na autenticação e os respectivos nove contatos.

As linhas SQL antigas também não tinham identidades de provedor de e-mail.
A correção dos nove endereços criou suas respectivas identidades pela API
oficial. Para os outros 21 alunos, uma execução com
`--ensure-email-identities --apply` completou apenas as identidades ausentes,
reenviando à API o mesmo e-mail já existente e confirmado. Essa etapa não
alterou e-mails, senhas ou papéis. A conferência final com `getUserById`
confirmou identidade de e-mail correspondente em todos os 30 alunos.

Foram preservados os 30 IDs dos alunos, nomes, matrículas, turma, curso e hashes
de senha. Não houve contas novas, contas excluídas, redefinição de senha ou
conteúdo pedagógico criado durante este reparo.

## Evidência final

| Conferência | Resultado |
| --- | --- |
| Usuários visíveis em Auth | 36: 30 alunos e seis profissionais |
| Alunos com e-mail correto e confirmado | 30 |
| Alunos com identidade de provedor de e-mail | 30 |
| IDs e matrículas de aluno preservados | 30 |
| Curso e turma dos alunos | Informática, turma existente |
| Login do aluno 01 por e-mail | Aprovado |
| Login do aluno 01 por matrícula existente | Aprovado |
| Login do aluno 30 por e-mail | Aprovado |
| Consulta do perfil próprio com RLS | Aprovada |
| Login do professor de Português | Aprovado |
| Login do professor de Matemática | Aprovado |
| Login do professor de Administração | Aprovado |
| Login do professor de Informática | Aprovado |
| Conferência de e-mails após reparo | Zero valores malformados |
| Senhas alteradas pelo reparo | Zero |
| Perfis ou contas criados/excluídos | Zero |

O verificador não tenta autenticar contas que a auditoria já comprovou ausentes;
testa um aluno e os quatro professores. A verificação de todos os 30 alunos
carrega suas identidades e perfis e testa também o último aluno, sem realizar
30 logins seguidos.

## Reprodução segura

```powershell
node --use-system-ca backend/scripts/repair-student-test-auth-emails.js
node --use-system-ca backend/scripts/restore-student-test-access.js --verify-only
node --use-system-ca backend/scripts/audit-auth-live-readonly.mjs
```

Os dois scripts de reparo usam conferência por padrão. O modo `--verify-only`
não altera contas. O restaurador impede criar uma conta quando a identidade
já existe em SQL, mas não é reconhecida pelo serviço de autenticação.

As consultas de diagnóstico em `scripts/qa/diagnose-student-auth.sql` são
somente leitura e não exibem senhas, hashes, tokens ou nomes dos alunos.

Referências oficiais: [admin.createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[admin.listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers),
[signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword),
[campos do usuário no GoTrue](https://github.com/supabase/auth/blob/master/internal/models/user.go).
