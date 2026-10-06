# Login e publicação manual no Netlify — 4 de outubro de 2026

## Diagnóstico

O pacote local contém os nove arquivos necessários à página de login, incluindo
o SDK, a configuração pública, o cliente, os estilos, a imagem e o script. Na
auditoria inicial, esses arquivos eram idênticos às fontes. Não foi encontrado
um arquivo essencial de login ausente na pasta de publicação.

A captura usava `profportugues`, enquanto a matrícula cadastrada e utilizada
pelo verificador do professor era `userprofportugues`. O login por matrícula
dependia da correspondência exata no servidor. Uma mensagem de credenciais
incorretas não comprova uma falha de hospedagem.

A auditoria real encontrou 30 perfis e 30 linhas correspondentes em `auth.users`,
mas o GoTrue não conseguia carregá-las: `instance_id` era NULL e quatro campos
de string tinham NULL em vez de vazio. Nove e-mails sintéticos também continham
espaços (`aluno 1` a `aluno 9`), contrariando os acessos documentados com zero à
esquerda. A listagem administrativa mostrava somente os seis profissionais e
retornava `user_not_found` para esses alunos; o SQL confirmou as linhas existentes.
Não eram contas ausentes e nenhuma identidade escolar precisou ser recriada.

O reparo de instância e campos vazios foi aplicado exclusivamente aos 30 alunos
sintéticos da turma documentada, preservando IDs, matrículas, curso, turma e
hashes das senhas. A comparação no banco confirmou que todos os 30 hashes já
correspondiam à senha de teste documentada. O script SQL restrito está em
`scripts/qa/repair-student-auth-instance.sql`; nenhum hash ou token foi registrado.
Os e-mails malformados são corrigidos pela API administrativa existente, usando
`backend/scripts/repair-student-test-auth-emails.js`, sem redefinir senhas.

O cliente passou a reconhecer quatro identificadores legados de professor,
incluindo `profportugues`, somente quando a matrícula exata não existe. O Auth
continua validando a senha e o perfil continua determinando o destino e as
permissões. Credenciais erradas permanecem rejeitadas.

O teste visual após login identificou outra pendência no servidor: a chamada
`listar_experiencias_aluno_studio` retornava HTTP 404 / `PGRST202`. A migração
base do Studio existia, mas a integração incremental de catálogo, retomada e
percurso, suas RPCs públicas e as colunas complementares ainda não estavam
instaladas. O diagnóstico confirmou zero publicações, tentativas e respostas.

Foram aplicadas as migrações existentes `20261003_omnistudio_fluxo_integrado.sql`
e `20261003_omnistudio_matematica.sql`, nessa ordem, em uma transação com trava
que impediria alterações caso surgissem publicações, tentativas ou respostas.
O script de implantação restrita está em `scripts/qa/deploy-studio-integration.sql`.
A instalação foi confirmada no editor administrativo e o cache da Data API foi
recarregado. O conjunto PostgreSQL local passou em 12/12 testes, incluindo
isolamento de turmas, rejeição de acesso anônimo e proteção do gabarito.

O aceite remoto confirmou: aluno autenticado recebe HTTP 200 com catálogo
vazio; professor recebe a rejeição de acesso restrito a alunos; anônimo recebe
permissão negada. A Home do aluno, servida pela prévia de `netlify-dist`, passou
a carregar normalmente sem o aviso de falha do Studio. Nenhuma atividade foi
criada ou publicada para demonstrar esse resultado.

Os testes visuais da pasta publicável confirmaram login por `profportugues` até
o dashboard de Português e login de `aluno01@teste.ominisaber.com` até seu painel.
O logout de ambos retornou ao login; após sair como aluno, navegar diretamente
ao seu dashboard também retornou ao login. Evidências em
`docs/qa/login-netlify-2026-10-04/professor-authenticated.png` e
`docs/qa/login-netlify-2026-10-04/student-authenticated.png`.

Essas conclusões distinguem o pacote local da hospedagem remota. Sem o endereço
do site publicado e uma conferência dos arquivos servidos, não se deve afirmar
que o Netlify foi validado remotamente.

## Preparar a publicação

Verificação desta correção: 30 contas de aluno reconhecidas pelo Auth, com IDs,
matrículas e turma preservados; e-mails e contatos sintéticos corretos; login
do primeiro aluno por e-mail e matrícula com perfil protegido por RLS. Nenhuma
senha foi alterada e nenhuma conta ou perfil foi criado ou apagado. O reparo de
e-mails é idempotente: a segunda conferência encontrou zero contatos incorretos.

O pacote foi regenerado e passou na comparação das 114 cópias públicas com as
fontes e dos 114 recursos servidos pela prévia HTTP local. Os 15 testes de
identificadores de login, preparação pública e importações de laboratório
passaram. Essas evidências não substituem a conferência do domínio publicado,
cujo endereço ainda não foi informado.

Publique **somente `netlify-dist`**. A pasta deve conter `index.html`, `frontend`,
`backend` com os clientes públicos, `engine`, `oministudio`, `_headers` e
`_redirects`. O Netlify deve servir `index.html` na raiz do site, sem um nível
extra chamado `netlify-dist` na URL.

Não envie a raiz inteira do projeto: ela contém variáveis de ambiente, scripts
administrativos, código de servidor e arquivos que não pertencem ao site público.
A chave publicável do Supabase pode estar no navegador; chaves secretas e
`service_role` não podem entrar nessa pasta.

Antes de gerar, execute:

```powershell
node scripts/prepare-netlify-site.mjs --check-only
node scripts/verify-professor-package.mjs --sources-only
```

O empacotador valida a URL HTTPS e o tipo de chave pública, os arquivos de entrada
e suas dependências antes de apagar a cópia anterior. Também rejeita links
simbólicos, variáveis de ambiente e pastas privadas nas fontes públicas. O
destino de remoção precisa resolver para a pasta local `netlify-dist` dentro do
projeto. `--check-only` não modifica a pasta.

Depois de corrigir qualquer erro do preflight:

```powershell
node scripts/prepare-netlify-site.mjs
node scripts/verify-professor-package.mjs
```

O verificador compara o pacote com as fontes. Ele inclui os nove arquivos do
login, o dashboard e o perfil do aluno com suas dependências, as páginas de
destino de todos os perfis, redefinição de senha, erro e as áreas do professor.
Também verifica a configuração pública nas fontes e no pacote sem imprimir
chaves. Esses checks verificam arquivos e configuração; **não autenticam contas**.

Uma prévia HTTP local da pasta publicada pode ser conferida separadamente:

```powershell
python -m http.server 4174 --bind 127.0.0.1 --directory netlify-dist
node scripts/verify-professor-package.mjs --url http://127.0.0.1:4174/
```

Use uma porta livre. A conferência HTTP do script é limitada a localhost e não
representa uma verificação do domínio Netlify.

No painel de deploys do site existente, arraste a pasta atualizada `netlify-dist`
para a área de publicação manual. Confira que os arquivos `_headers` e
`_redirects` também foram enviados.

## Teste real de autenticação, separado do empacotamento

1. Confirme no servidor que a conta existe, tem perfil escolar e está habilitada.
2. Teste o professor pela matrícula cadastrada e pelo e-mail, abrindo o dashboard
   correto após o login.
3. Teste um aluno existente pelo e-mail e pela matrícula; confira o dashboard e
   o perfil vinculados a essa conta.
4. Faça esses testes usando a prévia da pasta publicada e, depois da publicação,
   repita no domínio Netlify. Uma sessão já aberta no servidor local não prova
   que o login funciona em outra origem.
5. Faça logout e confirme que uma rota protegida retorna ao login. Não considere
   um HTML acessível por HTTP como prova de que a autenticação funcionou.

Registre apenas sucesso, tipo de acesso, destino e categoria de erro. Não inclua
senhas, tokens ou chaves nos logs. Não execute scripts de seed administrativos
para tentar corrigir uma falha de deploy sem primeiro confirmar o diagnóstico.

Referências oficiais:

- [Netlify — criação e atualização de deploys](https://docs.netlify.com/deploy/create-deploys/)
- [Supabase — login com senha](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
