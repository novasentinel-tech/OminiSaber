# Página inicial do aluno

A página inicial organiza os principais destinos do aluno em uma central de
aprendizagem. Avaliações, Trilhas e Matérias formam a primeira linha e recebem
o maior peso visual; exercícios, biblioteca, agenda, fórum e sites úteis ficam
na sequência. O destaque superior mostra a próxima atividade real ou confirma
que não existem pendências.

## Cores de situação

Os três destinos principais usam dados reais retornados por
`getStudentDashboard` para comunicar prioridade:

- vermelho: existe avaliação ou trilha não concluída cujo prazo terminou;
- amarelo: há conteúdo publicado ainda não concluído e dentro do prazo;
- verde: tudo que está disponível foi concluído ou não há pendências.

A regra usa vermelho antes de amarelo e amarelo antes de verde. Ao filtrar uma
matéria, tanto a cor quanto o texto de situação são recalculados somente com os
dados daquela disciplina.

## Filtro global por matéria

O filtro fica acima dos destinos e usa chips de acesso rápido em todos os
tamanhos. Em celulares, os chips formam uma faixa horizontal tocável com
rolagem e centralizam automaticamente a matéria ativa.

A escolha é persistida em `localStorage` pela chave
`ominisaber:student-subject-filter` e refletida na URL pelo parâmetro
`materia`. Ao selecionar Matemática, por exemplo, os cartões passam a apontar
para destinos como `atividades/index.html?materia=matematica` e
`modulo_de_trilhas/index.html?materia=matematica`.

O filtro também ajusta:

- próxima atividade ou estado sem pendências;
- títulos e descrições dos destinos;
- quantidade de avaliações pendentes;
- histórico da semana;
- atalhos de agenda.

## Integração entre páginas

As páginas de Atividades, Biblioteca, Trilhas e Agenda leem o parâmetro
`materia` e aplicam o recorte antes de exibir seus conteúdos. Assim, o contexto
selecionado na página inicial permanece durante a navegação.

## Arquitetura

- `index.html` contém a estrutura semântica da central e seus estados.
- `style.css` define o grid fluido para celular, tablet e computador.
- `script.js` usa `getStudentDashboard` pelo gateway compartilhado
  `backend/ominisaber-supabase-client.js`; o navegador não consulta tabelas
  diretamente.

## Estados e acessibilidade

O painel exibe carregamento, erro com nova tentativa e estados vazios. Chips
usam `aria-pressed`, possuem alvos de toque de 44 px no celular e a mudança de
matéria é anunciada pela região de status do sistema. A navegação inferior e o
conteúdo respeitam a área segura do aparelho.

Abra `index.html` por um servidor estático e use uma sessão autenticada de
aluno com curso e turma definidos.
