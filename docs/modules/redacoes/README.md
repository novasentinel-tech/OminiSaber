# Redações

## Objetivo

Cobrir proposta, planejamento, produção, envio, correção e devolutiva.

## Estrutura

Aluno: `frontend/aluno/laboratorio_de_redacao/`. Professor: `frontend/professor/professor_portugues/redacoes/`.

## Funcionamento

O aluno cria ou continua uma redação, salva versões e envia. O professor seleciona submissões das turmas vinculadas, lê o texto integral, atribui C1 a C5, calcula a nota, salva rascunho e publica a devolutiva.

### Sala de escrita do aluno

A produção textual acontece em `frontend/aluno/laboratorio_de_redacao/escrita/`, uma rota separada do laboratório e sem a sidebar global. O cabeçalho reduzido mantém o estado de sincronização e a saída do modo foco. No desktop, comando, textos motivadores e planejamento ficam disponíveis ao lado da folha; no celular, esses conteúdos abrem em um painel inferior acionado pelo dock de ferramentas.

O título e o corpo usam uma fila serial de salvamento. Cada palavra concluída solicita sincronização e uma pausa curta captura alterações ainda em andamento. O rascunho é salvo em `redacoes`; ao criar o primeiro registro, o identificador retornado é incorporado à URL para que recargas e retornos posteriores continuem exatamente a mesma redação. O Supabase permanece como fonte única, sem fallback em `localStorage`.

A área de texto possui 30 linhas pautadas e numeradas. A contagem considera as quebras visuais do texto na largura corrente, não apenas caracteres de nova linha. Ao atingir o limite, a interface mantém a última entrada válida e solicita que o aluno revise antes de continuar. O painel de apoio ocupa entre um quarto e um terço da largura no desktop, pode ser minimizado e permite ampliar individualmente cada referência; em telas pequenas, transforma-se em bottom sheet consultável.

## Banco de dados

`propostas_redacao`, `redacoes`, `planejamentos_redacao`, `repertorios_redacao`, `versoes_redacao`, `comentarios_redacao`, `avaliacoes_competencias_redacao` e `rascunhos_correcao_redacao`.

## Permissões

O aluno administra a própria produção. O professor de Português corrige redações de seus alunos. RLS e a função transacional `corrigir_redacao` protegem o fluxo.

## Pontos de atenção

A especificação detalhada está preservada em [jornada completa](../../legacy/redacao-jornada-completa.md).
