# Fluxos de dados

Os diagramas completos de perfis, autenticação, atividades, resultados, biblioteca
e Copiloto estão em [Fluxogramas do sistema](fluxogramas.md).

## Sessão e roteamento

1. A página carrega a configuração pública e o cliente compartilhado.
2. Supabase Auth restaura ou cria a sessão.
3. O cliente lê `perfis` e identifica papel, turma, curso e especialidade.
4. A aplicação direciona para a área autorizada.
5. Cada consulta continua limitada por RLS; o roteamento não concede acesso.

## Atividade completa

1. O gestor mantém catálogo curricular e vínculos docentes.
2. O professor escolhe turma, matéria e descritores.
3. `criar_atividade_docente` valida e grava avaliação, questões, gabaritos e
   relações curriculares na mesma transação.
4. A publicação cria uma versão imutável, sem gabarito, para o aluno.
5. O aluno inicia uma tentativa, salva uma resposta por questão e entrega.
6. Um trigger corrige formatos determinísticos e marca questões abertas para revisão.
7. O professor corrige as pendências; a nota final é recalculada no banco.
8. O painel agrega turma, questões e descritores.
9. Ajustes exigem justificativa; recuperação nasce como novo rascunho.

## Copiloto docente

1. O professor autenticado seleciona o contexto no construtor.
2. O navegador chama a Edge Function com JWT.
3. A função valida papel, feature flag, origem, limites e vínculo.
4. Apenas contexto pedagógico necessário segue para a OpenAI.
5. A resposta estruturada é normalizada e apresentada como prévia.
6. O professor pode aplicar a sugestão ao rascunho e editá-la.
7. A publicação continua sendo uma ação separada e explícita.

## Estados e falhas

Consultas retornam conteúdo real ou estado vazio. Erros de relação, RLS, sessão ou
configuração devem aparecer com contexto suficiente para diagnóstico. Nenhum fluxo
substitui uma falha por valores mockados.
