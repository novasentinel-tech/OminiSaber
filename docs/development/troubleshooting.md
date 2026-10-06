# Troubleshooting

## Supabase não conecta

Confira URL, chave anon, carregamento da biblioteca e console do navegador.

## Dados não aparecem

Verifique sessão, perfil, vínculos em `professor_turma_materias`, turma do aluno,
status publicado e RLS. Se o vínculo veio do módulo legado, confirme também se a
sincronização para a tabela canônica ocorreu.

## Erro de relacionamento PostgREST

Consulte as FKs do schema e use a constraint explícita no `select`, sem remover relações legítimas.

## Migração falha

Confirme a ordem cronológica, a existência de extensões e a execução no projeto correto. Não use operações destrutivas para contornar o problema.
