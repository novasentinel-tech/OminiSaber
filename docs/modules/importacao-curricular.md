# Importação inteligente de currículo

## Arquitetura

A página de Descritores do Portal Gestor recebe PDFs oficiais e extrai texto por página no navegador com PDF.js. O parser híbrido em `frontend/gestor/shared/curriculo-parser.js` usa regex para códigos de habilidades (`EM13LP01`, `EM13CO15`) e descritores (`D023_P`) e heurísticas para série, trimestre, quinzena, semana, expectativas e objetos. A análise é colocada em staging; não há publicação automática.

A camada de interpretação é deliberadamente independente do layout de uma disciplina. Novos formatos podem ser atendidos adicionando detectores/adaptadores ao parser sem alterar o modelo relacional.

## Fluxo

`PDF -> texto por página -> detecção estrutural -> staging -> revisão do Gestor -> RPC de aprovação -> catálogo curricular`

O documento é identificado por SHA-256. Uma segunda tentativa do mesmo arquivo é informada como duplicata. Cada item guarda confiança, estado e `source_page`, permitindo auditoria no documento original.

Estados da importação: `upload`, `processando`, `revisao`, `aprovada`, `rejeitada` e `erro`. Itens com confiança abaixo de 90% ficam em `revisar`; a tela bloqueia a aprovação até que sejam aprovados ou rejeitados individualmente.

No escopo exclusivo de Ensino Médio, códigos `EM...` são emitidos como `habilidade` com etapa `ensino_medio`. Códigos `EF...` são preservados como `referencia_ensino_fundamental`, sempre em revisão, e não são materializados como habilidades principais.

## Modelo de dados

- `curriculos`: entidade anual por origem, ano, componente e versão.
- `curriculo_periodos`: série e trimestre, com chave única por currículo. Os três PDFs do ano compartilham o mesmo currículo e apenas acrescentam períodos.
- `habilidades_curriculares`: catálogo deduplicado por código e componente.
- `habilidade_curriculo_periodos`: quinzena, semana e página da fonte.
- `descritores_curriculares`: catálogo legado reutilizado; série/trimestre podem ficar nulos porque o contexto pertence ao vínculo.
- `habilidade_descritores`: relação muitos-para-muitos por período. Uma habilidade sem descritor permanece armazenada sem linhas nessa tabela.
- `expectativas_aprendizagem`, `objetos_conhecimento` e `habilidade_objetos`: estruturas pedagógicas normalizadas por habilidade e período.
- `importacoes_curriculo` e `importacoes_curriculo_itens`: staging, metadados, erros, resumo, confiança e revisão.

A RPC `aprovar_importacao_curriculo` é exclusiva de Gestor. Ela cria/reutiliza o currículo anual, períodos, habilidades, descritores, expectativas e objetos com `ON CONFLICT`, e só considera itens não rejeitados.

Na Fase 3, o PDF é validado e armazenado pela Edge Function `curriculo-upload` no bucket privado `curriculos-pdfs`, usando o caminho `{gestor_id}/{uuid}.pdf`. A RPC `criar_importacao_curriculo` cria importação e itens na mesma transação. A aprovação usa `pg_advisory_xact_lock`, reutiliza períodos com a mesma série/trimestre, retorna a versão já associada quando repetida e grava auditoria. O reprocessamento cria novo staging ligado à importação anterior, sem modificar versões publicadas.

Na Fase 3.2, o texto extraído (`p_texto`) deixou de ser requisito para criar o staging e pode ser nulo ou vazio. A publicação exige pelo menos uma habilidade EM com status `ok` ou `aprovado`; itens rejeitados continuam fora da materialização. Essa regra é verificada antes da criação da nova versão e do arquivamento da versão anterior.

O servidor valida extensão, MIME, tamanho, assinatura `%PDF-`, marcador `%%EOF` e SHA-256. O texto extraído continua sendo produzido pelo PDF.js no cliente e armazenado como dado não confiável; esta Edge Function não faz parsing completo de PDF nem confirma texto selecionável. Essa validação deve ser adicionada em uma etapa posterior com runtime de parsing/OCR apropriado.

### Dívidas técnicas da Fase 1

- `max(versao) + 1` ainda precisa de uma estratégia de concorrência no banco.
- Habilidades e descritores são entidades globais reutilizadas; versões ainda não são snapshots históricos totalmente imutáveis.
- Os padrões de habilidades devem permanecer adequados ao Ensino Médio e não evoluir para um parser genérico de toda a BNCC.

## Segurança e versionamento

Todas as tabelas curriculares têm RLS. Gestores fazem upload, revisão, aprovação e publicação; usuários autenticados consultam apenas currículos publicados. O PDF não é enviado para IA externa e não há chave secreta no frontend. A versão é mantida em `curriculos.versao`; versões arquivadas não são sobrescritas.

## Troubleshooting

- **PDF sem texto**: o extrator retorna erro para revisão; use OCR externamente e importe o texto revisado, sem inventar códigos.
- **Série ou trimestre ausente**: itens ficam com baixa confiança e não são materializados até a correção na revisão.
- **Tabela quebrada**: confira `source_page`, edite ou rejeite o item; relações ausentes não são criadas automaticamente.
- **Código repetido**: o catálogo é reutilizado por código e componente, enquanto o contexto é um novo vínculo de período.
- **Mesmo arquivo novamente**: compare o hash SHA-256; escolha cancelar ou tratar como nova revisão fora do fluxo automático.

## Testes com PDFs SEDU-ES

Use um PDF de trimestre único e valide a página de origem. Repita com os três trimestres usando a mesma origem, ano e componente e confira os períodos do currículo. Também teste um documento com as três séries, códigos repetidos, uma habilidade com “Não apresenta descritor relacionado”, PDF escaneado, tabela quebrada e uma atualização da SEDU. Antes de publicar, revise todos os itens abaixo de 90%.
