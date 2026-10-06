# Módulo do aluno

## Objetivo

Entregar uma jornada coerente e responsiva de aprendizagem, usando somente matérias
liberadas ao perfil e dados persistidos no Supabase.

## Navegação

- Início;
- Trilhas;
- Atividades;
- Redação;
- Evolução e mapa de dificuldades;
- Biblioteca;
- Notificações e agenda;
- Perfil;
- Ajuda e suporte.

A área separada de configurações foi removida; preferências do usuário pertencem ao
perfil quando forem suportadas.

## Matérias

O acesso considera série, turma e curso técnico. A base atual prioriza Português e
Literatura, Matemática, Física e, conforme o curso, componentes de Administração ou
Informática. Redação possui jornada própria, mas pode compartilhar evidências e
agenda.

## Atividades

O aluno vê somente publicações válidas para sua turma. Pode iniciar, salvar,
retomar e entregar dentro das regras definidas. Depois da entrega, respostas ficam
bloqueadas; questões objetivas são corrigidas automaticamente e abertas aguardam o
professor.

## Evolução

O “Geral” e os nós de dificuldade usam `desempenho_aluno_descritores()`. O cálculo
considera a tentativa corrigida mais recente de cada avaliação e pondera pontos
obtidos pelos possíveis. Quando não existem evidências, a interface deve dizer “sem
registros”, não inventar percentuais ou níveis.

## Biblioteca

Materiais digitais com PDF autorizado podem ser baixados. Livros físicos aparecem
como catálogo e geram solicitação; o aluno não marca o item como “lendo” nem abre um
livro físico diretamente.

## Responsividade

Desktop e celular usam a mesma informação. A sidebar pode recolher no desktop e
funciona como painel sobreposto no mobile sem reduzir a página a uma largura
ilegível.

## Dados principais

`perfis`, `turmas`, matérias liberadas, trilhas, conteúdos, avaliações, tentativas,
respostas, desempenho curricular, redações, agenda, notificações, biblioteca e
conquistas.
