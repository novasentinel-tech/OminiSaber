# Copiloto docente — biblioteca de Língua Portuguesa

## Objetivo

O Copiloto usa uma biblioteca pedagógica com **77 casos de Língua Portuguesa** para orientar a criação e a revisão de atividades. A biblioteca não publica nada automaticamente: ela prepara um rascunho que continua sob revisão do professor.

## Cobertura

- Leitura literal, inferencial, crítica e multimodal.
- Coesão, coerência, vocabulário, comparação de textos e confiabilidade de fontes.
- Tese, argumentos, evidências, contra-argumentação e falácias.
- Gêneros jornalísticos, literários, digitais, acadêmicos e de circulação cotidiana.
- Morfologia, sintaxe, semântica, ortografia, pontuação e variação linguística.
- Escolas literárias e literatura contemporânea.
- Planejamento, desenvolvimento, conclusão, revisão e repertório para redação.
- Oralidade, seminário, fluência, diagnóstico, recuperação e acessibilidade.

## Como os casos são escolhidos

1. O servidor reúne o pedido do professor, a turma, os descritores opcionais, a categoria, a prioridade e os formatos permitidos.
2. O texto é normalizado apenas para seleção interna de palavras-chave.
3. São escolhidos até quatro casos relevantes no modo normal e até oito quando **Habilitar tudo** está ativo.
4. As orientações selecionadas são incorporadas ao comando seguro enviado ao Gemini.
5. Quando o professor escolhe descritores, a saída fica limitada às habilidades validadas no Supabase. Sem descritores, o Copiloto usa a série, a matéria, o pedido e o contexto autorizado da turma, mantendo `habilidade_ids` vazio.

## Seleção de turma e descritores opcionais

- A turma é herdada do construtor e pode ser ajustada no contexto do Copiloto, sem um segundo fluxo de etapas.
- A escolha é sincronizada com o contexto da atividade e continua sujeita à validação do vínculo professor–turma–matéria no servidor.
- Descritores deixam de bloquear a geração. Eles continuam disponíveis para propostas que precisam de alinhamento curricular explícito.
- Sem descritores, o Copiloto não inventa códigos curriculares e gera o rascunho sem vínculos de habilidade.

## Habilitar tudo

O controle marca os oito formatos disponíveis e ativa um planejamento ampliado. Antes de devolver o JSON, o modelo recebe orientação para comparar formatos, variar interações com propósito, verificar progressão, gabarito, clareza e distribuição de pontos. O raciocínio interno não é exibido ao usuário.

## Biblioteca transversal para outras matérias

Além dos casos de Português, o Copiloto consulta
`backend/supabase/functions/professor-copiloto/general-prompt-library.ts`.
Essa biblioteca cobre Matemática, Física, Química, Biologia e componentes
técnicos, incluindo diagnóstico, investigação, análise de erros, plano
cartesiano, fórmulas químicas, experimentos, código, depuração, planilhas,
avaliação, diferenciação, acessibilidade e trilhas.

## Segurança pedagógica e privacidade

- A biblioteca específica de Português é aplicada somente quando a matéria
  validada é Português; a biblioteca transversal atende as demais matérias.
- O modelo não pode inventar códigos curriculares.
- Dados individuais de alunos não entram no comando.
- O contexto da turma é agregado e depende do consentimento apresentado no Copiloto.
- A sugestão nunca publica, corrige ou atribui nota sem ação explícita do professor.

## Rework da conversa

A conversa acompanha a proposta atual, inclusive ajustes feitos pelo professor. A saída distingue atividades, percursos e ideias; percursos exigem atividades completas e uma conexão entre etapas. Ideias incluem o que o aluno fará e qual evidência permitirá verificar a aprendizagem. A validação rejeita alternativas, gabaritos, pontos, etapas ou formatos inconsistentes, em vez de apresentar uma proposta incompleta como pronta.

## Arquivos principais

- `backend/supabase/functions/professor-copiloto/portuguese-prompt-library.ts`
- `backend/supabase/functions/professor-copiloto/general-prompt-library.ts`
- `backend/supabase/functions/professor-copiloto/index.ts`
- `frontend/professor/specialty/teacher-copilot.js`
- `frontend/shared/omni-select.js`

## Validação

O teste `backend/scripts/check-copilot-phase3.js` exige pelo menos 70 casos, identificadores únicos, integração do planejamento ampliado, ausência de segredo no front-end e JWT obrigatório na Edge Function.

