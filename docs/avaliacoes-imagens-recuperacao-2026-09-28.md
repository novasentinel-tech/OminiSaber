# Avaliações — referências visuais, cálculo e correções de resultados

Data: 28/09/2026

## Escopo entregue

- O cabeçalho azul dos blocos do construtor agora usa texto branco em todos os títulos, rótulos e estados, preservando contraste em desktop, tablet e celular.
- Toda questão pode receber uma imagem de referência em PNG, JPG ou WebP.
- A imagem é otimizada no navegador para até 1600 px antes de ser salva, evitando anexos excessivamente pesados.
- O professor informa uma descrição acessível; o aluno recebe a imagem junto ao enunciado, com legenda e texto alternativo.
- Questões do tipo Cálculo possuem um campo próprio para função ou expressão matemática, exibido em destaque na experiência do aluno.
- Os formatos existentes continuam determinando a interação de resposta do aluno: alternativas, associação, ordenação, número, cálculo, plano cartesiano, reta numérica, geometria, gráfico, texto e código.

## Persistência e segurança

A imagem otimizada e sua descrição são guardadas em `questoes_avaliacao.configuracao`, o mesmo JSON protegido pelas políticas de leitura da avaliação. Assim, não foi criado um endereço público de arquivo nem um bucket aberto. O aluno só recebe o material quando já possui acesso à própria avaliação.

A migração `20260928_corrigir_recuperacao_ajuste_nota.sql`:

- mantém `ajustar_nota_avaliacao` como `security invoker`;
- remove o bloqueio `FOR SHARE`, que exigia privilégio incompatível com o papel do professor;
- concede inserção na auditoria apenas a usuários autenticados;
- aplica RLS exigindo que o ator seja o usuário da sessão e seja gestor ou proprietário da avaliação.

O cliente também possui um caminho de compatibilidade para ambientes ainda sem a migração: o ajuste é gravado na tabela auditável autorizada e a recuperação é recriada pelo RPC atômico já existente. A regra definitiva continua sendo a migração do banco.

## Validação executada

- Ajuste da nota de uma tentativa corrigida: aprovado; o registro apareceu no histórico de auditoria.
- Criação de recuperação focada: aprovada; o rascunho apareceu na lista com as duas questões do descritor selecionado.
- Os registros usados exclusivamente na validação foram removidos depois do teste.
- Construtor verificado em desktop e em viewport Android de 390 × 844 px.
- Contraste computado no navegador: título e rótulo do cabeçalho em `rgb(255, 255, 255)`.
- Verificadores do construtor, aluno, onboarding e resultados: aprovados.

## Tutorial do aluno

O passo 4 agora prioriza o seletor real de etapas do Laboratório de redação. Isso impede que o destaque cresça sobre o título principal quando a navegação compartilhada ainda estiver terminando de montar.
