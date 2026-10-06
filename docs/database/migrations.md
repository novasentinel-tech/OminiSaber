# Migrations

## Objetivo

Documentar a evolução incremental do banco.

## Estrutura

As migrations ficam em `backend/migrations/` e usam prefixo de data.

## Migrations importantes

- `20260831_acesso_materias_aluno.sql`: acesso do aluno às matérias.
- `20260831_agenda_notificacoes.sql`: agenda, notificações e policies.
- `20260831_redacao_jornada_completa.sql`: jornada de redação.
- `20260831_trilhas_estudos_completos.sql`: trilhas e estudos.
- `20260902_biblioteca_acervo_unificado.sql`: biblioteca unificada.
- `20260903_portal_gestor.sql`: portal do gestor.
- `20260903_redacoes_avaliacoes_portugues.sql`: suporte incremental à correção de redações em Português.
- `20260908_engine_atividades_fase2_1.sql`: fundação do motor unificado de atividades, vínculos professor-turma-matéria, versionamento, respostas normalizadas e RLS.
- `20260908_engine_atividades_fase2_1_ajustes.sql`: índices e políticas refinados após os advisors do Supabase.
- `20260908_construtor_atividades_fase2_2.sql`: RPC transacional usada pelo construtor docente para gravar questões, gabaritos e descritores de forma atômica.
- `20260908_execucao_correcao_atividades_fase2_3.sql`: tentativas múltiplas, salvamento por questão, entrega protegida e correção automática dos formatos objetivos.
- `20260908_execucao_correcao_atividades_fase2_3_ajustes.sql`: compatibiliza o início da tentativa com os privilégios mínimos concedidos ao aluno.
- `20260908_execucao_correcao_atividades_fase2_3_compatibilidade.sql`: integra a correção automática ao validador legado sem ampliar as colunas alteráveis pelo navegador.
- `20260908_correcao_docente_resultados_fase2_3.sql`: correção manual protegida, fechamento automático da nota, auditoria e relatórios por aluno e descritor.
- `20260908_correcao_docente_resultados_fase2_3_ajustes.sql`: move o recálculo privilegiado para um gatilho interno e mantém a função pública como `security invoker`, autorizada por RLS.
- `20260908_vinculos_docentes_compatibilidade_fase2_3.sql`: sincroniza vínculos criados pelo Gestor com o motor por matéria e libera a leitura correta de turmas e alunos vinculados.
- `20260908_resultados_recuperacao_fase2_4.sql`: métricas completas da turma, questões difíceis, desempenho por descritor, ajustes de nota auditáveis, recuperação focada e indicador real do aluno.
- `20260908_resultados_recuperacao_fase2_4_ajustes.sql`: elimina ambiguidade na validação das habilidades selecionadas para a recuperação.
- `20260908_resultados_recuperacao_fase2_4_indices.sql`: adiciona os índices recomendados para responsáveis e alunos no histórico de ajustes.
- `20260909_corrigir_execucao_criar_atividade_docente.sql`: permite que a RPC pública execute sua validação interna no schema privado sem expor esse schema aos clientes; sessão, perfil e vínculo turma/matéria continuam obrigatórios.
- `20260909_atividade_docente_privilegios_minimos.sql`: restaura `security invoker` na RPC, concede apenas resolução do schema privado ao papel autenticado e revoga a execução direta da rotina de trigger.
- `20260909122618_atividades_aluno_dashboard_notificacoes.sql`: conecta publicações docentes à Central de Notificações, retroalimenta avaliações publicadas e sustenta os contadores e o próximo passo do aluno com dados reais.
- `20260910_corrigir_codigos_curriculares_matematica.sql`: amplia a validação curricular para códigos com três letras, como `EM13MAT...`, liberando a busca e o vínculo de habilidades de Matemática no construtor.
- `20260910_integridade_formatos_atividade.sql`: valida os contratos JSON dos formatos interativos, aplica tolerância numérica e respostas curtas alternativas na correção automática e corrige o vínculo da política de ajuste manual de nota.
- `20260910_integridade_formatos_atividade_ajustes.sql`: restringe a execução privilegiada do validador de gabarito ao gatilho interno, mantendo a rotina inacessível a `anon` e `authenticated`.
- `20260910_laboratorio_medidas_geometricas.sql`: adiciona ao contrato matemático figuras 2D, sólidos 3D e formas personalizadas, validando dimensão, forma, medidas positivas, unidade, objetivo, lados, resposta e tolerância antes da gravação.
- `20260910_proteger_gabarito_geometria.sql`: impede que a resposta correta e a resolução permaneçam na configuração pública do laboratório geométrico.
- `20260909_copiloto_docente_fase3_0.sql`: cria feature flags, sessões, execuções, feedback, limites e políticas RLS do Copiloto docente; o recurso nasce desativado para preservar o ambiente beta.
- `20260909081800_fase3_advisors_ajustes.sql`: elimina políticas permissivas redundantes da Fase 3, fixa o `search_path` do trigger compartilhado e adiciona o índice administrativo recomendado pelo advisor.
- `20260925090000_organizacao_governanca_banco.sql`: completa índices de chaves estrangeiras sem cobertura e instala um diagnóstico interno, restrito ao `service_role`, para RLS, chaves primárias, constraints e índices relacionais.
- `20261003_omnistudio_fluxo_integrado.sql`: completa os dezesseis tipos do Studio, catálogo e notificações do aluno, retomada de tentativas, snapshot seguro por versão, decisões no servidor, autosalvamento parcial, confirmação, entrega completa por percurso, correção auditada e isolamento de notas. Validada em PostgreSQL local embarcado; o deploy remoto deve ser verificado separadamente.
- `20261003_omnistudio_matematica.sql`: preserva a validação integrada e acrescenta limites para fórmulas de apoio, variáveis, orientações de resolução e janelas do plano cartesiano. Mantém os helpers privados e as configurações públicas no snapshot do aluno. Validada junto ao fluxo de publicação em PostgreSQL local; não aplicada remotamente nesta sessão.

## Funcionamento

Aplique migrations em ordem cronológica no projeto Supabase correto. Elas devem ser idempotentes quando indicado pelo SQL.

Antes de promover uma migration, execute `npm run database:governance:check` na
pasta `backend`. O verificador falha se uma migration não estiver incluída no
schema consolidado.

## Pontos de atenção

Não usar `DROP` destrutivo para resolver divergências de ambiente. Para banco novo, consulte `backend/README-SQL.md`.
