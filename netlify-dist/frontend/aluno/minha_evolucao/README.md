# Minha evolução

Painel gamificado de acompanhamento acadêmico do aluno. A página consulta os dados reais por meio de `window.OminiSaber` e não acessa tabelas do Supabase diretamente.

## Dados utilizados

- `listStudentNotes`: médias gerais e médias por bimestre para o gráfico de linha.
- `listStudentProgress`: atividades concluídas e pendentes para XP, progresso e gráfico de rosca.
- `listStudentRedacoes`: contagem de redações e histórico com status e feedback.
- `listStudentLoans`: empréstimos devolvidos para a conquista **Leitor Assíduo**.

## XP e níveis

O XP é calculado no cliente para manter o painel explicável:

- 100 XP por atividade concluída.
- 150 XP por redação registrada.
- Cada nível possui 500 XP.
- O nível é `floor(XP / 500) + 1`.
- A barra exibe o percentual do XP acumulado dentro do nível atual.

Os títulos são progressivos: **Explorador** até o nível 2, **Desbravador** do nível 3 ao 4 e **Mestre das Trilhas** a partir do nível 5.

## Medalhas

- **Primeira Redação:** pelo menos uma redação registrada.
- **Foco Total:** média acima de 8 em qualquer matéria.
- **Leitor Assíduo:** pelo menos um empréstimo com status `devolvido`.
- **Maratonista de Trilhas:** cinco ou mais atividades concluídas.

Medalhas desbloqueadas recebem cor e destaque; as demais permanecem em escala neutra com cadeado.

## Visualização e estados

O gráfico de linha agrupa notas pelos bimestres 1 a 4. O gráfico de rosca compara atividades concluídas e pendentes. Quando não existem notas ou atividades, o canvas é ocultado e uma mensagem contextual aparece no mesmo espaço. O histórico combina avaliações, redações e atividades em uma tabela responsiva.

A interface usa os tokens do OminiSaber Clarity: Poppins para títulos, Inter para leitura, índigo para foco, esmeralda para conclusão e superfícies claras com bordas sutis.

## Galeria de conquistas

Acesse `./medalhas.html` pelo badge de nível da evolução. A galeria carrega todas as conquistas em `conquistas` e cruza os registros do aluno autenticado em `conquistas_aluno` usando `aluno_id` da sessão Supabase. Cards desbloqueados exibem data e XP; cards bloqueados exibem cadeado e requisito.

Os filtros de `Todas`, `Trilhas`, `Redação`, `Leitura` e `Geral` são aplicados no cliente sem nova consulta. O script exclusivo `medalhas.js` também calcula o resumo de nível e XP a partir das conquistas desbloqueadas e exibe loading, erro e estado vazio.

Como o escopo desta tela não altera o gateway, a galeria usa o cliente público já inicializado em `window.OminiSaber.client`. As consultas continuam protegidas pelas políticas RLS do Supabase.

Se `conquistas` ou `conquistas_aluno` ainda não existirem, ou se o PostgREST retornar `PGRST200`, `PGRST205` ou uma mensagem de `schema cache`, `medalhas.js` carrega quatro medalhas locais padrão e sinaliza o modo de demonstração sem interromper a página. O catálogo persistente pode ser instalado executando `backend/schema/conquistas.sql`, que cria as tabelas, policies, grants e registros iniciais.
