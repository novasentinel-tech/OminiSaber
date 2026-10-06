# Autenticação

## Modelo

Supabase Auth mantém identidade e sessão. `public.perfis.id` referencia
`auth.users.id` e acrescenta os dados usados pelo produto: papel, nome, matrícula,
turma, curso técnico e especialidade docente.

Papéis principais:

- `aluno`;
- `professor`;
- `gestor`;
- `bibliotecaria`.

Especialidades docentes:

- `matematica`;
- `portugues`;
- `tecnico_administracao`;
- `tecnico_informatica`.

O acesso real a uma matéria depende também de `professor_turma_materias`.

## Login

O usuário pode informar matrícula ou e-mail. Para matrícula, a função
`email_por_matricula(text)` resolve o identificador e o Auth valida a senha. Depois
da sessão, o perfil determina a rota inicial.

Cadastro público cria somente aluno. Contas privilegiadas e redefinições
administrativas passam pelo Gestor e por operações de servidor.

## Sessão

- páginas protegidas exigem sessão válida e papel compatível;
- logout remove a sessão antes de retornar ao login;
- uma interface não deve inventar perfil quando a leitura falha;
- Edge Functions chamadas por usuários validam o JWT e a identidade no servidor.

## Risco conhecido

`email_por_matricula(text)` é uma função `SECURITY DEFINER` disponível antes do
login. Ela permanece por compatibilidade e exige auditoria específica de enumeração,
mensagens uniformes e limitação de tentativas. Não amplie seu retorno.
