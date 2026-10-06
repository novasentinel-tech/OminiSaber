# Policies RLS

## Modelo de defesa

O acesso depende de três camadas: chave do componente, sessão do usuário e policies
do PostgreSQL. A publishable key identifica o frontend; o JWT identifica a pessoa;
RLS decide quais linhas e operações estão autorizadas.

## Regras por papel

- aluno: próprios registros e conteúdo publicado para sua turma;
- professor: autoria própria e combinações ativas em
  `professor_turma_materias`;
- gestor: operações administrativas previstas, sem uso da interface como barreira;
- bibliotecária: acervo e circulação, sem permissão pedagógica implícita.

## Dados especialmente protegidos

- gabaritos não são selecionáveis pelo aluno;
- notas e estado de correção não são editáveis pelo aluno;
- histórico de ajuste é acrescentado por operação autorizada, não reescrito;
- execuções do Copiloto não são acessíveis por `anon`;
- cada professor lê seu histórico do Copiloto; gestor possui supervisão prevista;
- secret e service role keys não participam do bundle público.

## Funções privilegiadas

Uma função `SECURITY DEFINER` deve definir `search_path = ''`, qualificar objetos,
validar sessão e papel e revogar execução pública desnecessária. Prefira
`SECURITY INVOKER` quando RLS e grants forem suficientes.

## Checklist de uma policy

1. habilitar RLS na tabela;
2. revogar privilégios amplos;
3. conceder somente operações necessárias;
4. escrever policies separadas por ação quando isso tornar a intenção mais clara;
5. testar usuário permitido, outro usuário, outro papel e `anon`;
6. executar advisors depois da migration.

RLS nunca deve ser desligado como solução para erro de tela.
