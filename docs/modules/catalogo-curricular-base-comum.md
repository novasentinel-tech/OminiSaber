# Catálogo curricular da base comum

## Escopo

O catálogo inicial do OminiSaber cobre cinco componentes da Formação Geral Básica do Ensino Médio:

- Língua Portuguesa, incluindo o campo literário;
- Matemática;
- Física;
- Química;
- Biologia.

Redação permanece como um tipo de produção/atividade, e não como um sexto currículo independente. Administração e Informática continuam como componentes técnicos e serão catalogados em uma etapa própria.

## Fontes e rastreabilidade

O arquivo `backend/data/catalogo-curricular-base-comum-2026.json` é gerado a partir das Orientações Curriculares 2026 da SEDU-ES, alinhadas à BNCC. Português e Matemática usam um documento para cada trimestre. Física, Química e Biologia usam documentos anuais com a distribuição interna por série e trimestre.

Cada ocorrência guarda:

- componente, série e trimestre;
- código e descrição da habilidade;
- unidade temática, quando publicada pela fonte;
- objetos de conhecimento;
- expectativas de aprendizagem;
- descritores PAEBES/SAEB relacionados;
- arquivo e página de origem.

Esses metadados permitem auditar o catálogo e são a base para seleção, geração e correção de atividades.

## Modelo relacional

`habilidades_curriculares` contém a definição única da habilidade. `habilidade_curriculo_periodos` registra todas as ocorrências por série e trimestre e também guarda unidade temática, arquivo e página.

`descritores_curriculares` contém a definição canônica do descritor avaliativo. Como um mesmo descritor pode ocorrer em várias séries e trimestres, `descritor_curriculo_periodos` registra essa distribuição sem duplicar o código. `habilidade_descritores` preserva a relação entre habilidade, descritor e período.

Expectativas e objetos continuam normalizados em `expectativas_aprendizagem`, `objetos_conhecimento` e `habilidade_objetos`.

## Uso pelo motor de atividades

A RPC `buscar_catalogo_curricular_detalhado` recebe matéria e filtros opcionais de série, trimestre e busca. Ela retorna uma habilidade por período com todos os detalhes necessários para o professor montar uma atividade:

1. selecionar componente, série e trimestre;
2. selecionar uma habilidade;
3. consultar objetos, expectativas e descritores associados;
4. escolher o formato da atividade;
5. definir pontuação, pesos e critérios de correção.

O cliente disponibiliza essa consulta por `OminiSaber.listDetailedCurriculumCatalog(...)`. Nenhum conteúdo fictício é usado como fallback.

## Atualização do catálogo

1. Coloque os PDFs oficiais nas localizações esperadas pelo gerador ou ajuste os caminhos informados ao script.
2. Execute `backend/scripts/build-common-curriculum-catalog.py` com o Python de documentos do workspace.
3. Execute `node backend/scripts/generate-common-curriculum-migration.js`.
4. Rode os validadores e gere novamente `backend/ominisaber-schema-completo.sql`.

Em um banco já existente, aplique primeiro `20260907_base_comum_enum.sql` e confirme a transação. Depois aplique `20260907_catalogo_curricular_base_comum.sql`. Essa separação é necessária porque novos valores de enum só podem ser usados após o commit da alteração.

## Segurança

- somente o Gestor pode alterar vínculos curriculares diretamente;
- usuários autenticados têm leitura do catálogo;
- as funções de consulta usam `security invoker` e respeitam RLS;
- o seed é idempotente e usa chaves únicas e `ON CONFLICT`;
- não há chave do Supabase, dado pessoal ou conteúdo de aluno no catálogo;
- arquivo e página de origem acompanham o dado para revisão pedagógica.

## Limites conscientes

O catálogo inicial não cria turmas, não distribui atividades e não altera permissões de especialidade dos professores. Essas partes pertencem ao motor de atividades e ao vínculo institucional. Também não transforma habilidades de Computação citadas como apoio nos PDFs em habilidades principais das cinco matérias.
