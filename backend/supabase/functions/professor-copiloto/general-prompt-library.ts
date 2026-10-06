export type GeneralPromptCase = {
  id: string;
  title: string;
  keywords: string[];
  prompt: string;
};

// Orientações transversais para Matemática, Ciências e componentes técnicos.
// São instruções pedagógicas, não respostas prontas nem dados de alunos.
const cases: GeneralPromptCase[] = [
  { id: "diagnostico-inicial", title: "Diagnóstico inicial", keywords: ["diagnostico", "nivel", "conhecimentos previos"], prompt: "Comece com itens curtos que revelem estratégias e conhecimentos prévios; use os resultados para propor uma progressão, não para rotular o estudante." },
  { id: "problema-contextualizado", title: "Problema contextualizado", keywords: ["problema", "situacao", "contexto", "cotidiano"], prompt: "Apresente uma situação plausível, dados suficientes, pergunta clara e espaço para justificar o caminho, evitando contexto decorativo." },
  { id: "investigacao", title: "Investigação guiada", keywords: ["investigacao", "explorar", "hipotese", "descobrir"], prompt: "Organize hipótese, observação, registro de evidências, análise e conclusão; não entregue a regra antes da exploração." },
  { id: "erro-produtivo", title: "Análise de erro", keywords: ["erro", "distrator", "corrigir", "feedback"], prompt: "Inclua uma solução plausível porém incorreta e peça para localizar, explicar e corrigir o erro com feedback formativo." },
  { id: "representacoes", title: "Múltiplas representações", keywords: ["representacao", "grafico", "tabela", "diagrama"], prompt: "Conecte pelo menos duas representações do mesmo conceito e peça a conversão ou interpretação entre elas." },
  { id: "modelagem", title: "Modelagem", keywords: ["modelo", "modelagem", "variavel", "previsao"], prompt: "Defina variáveis, hipóteses, limitações e interpretação do resultado; diferencie modelo de realidade." },
  { id: "estimativa", title: "Estimativa e ordem de grandeza", keywords: ["estimativa", "aproximacao", "grandeza"], prompt: "Peça uma estimativa antes do cálculo exato e solicite comparação entre resultado, unidade e ordem de grandeza." },
  { id: "argumentacao-matematica", title: "Justificativa matemática", keywords: ["provar", "justificar", "demonstrar", "matematica"], prompt: "Valorize a cadeia de argumentos e a validade das propriedades usadas, não apenas a resposta final." },
  { id: "plano-cartesiano", title: "Plano cartesiano", keywords: ["plano cartesiano", "coordenada", "eixo", "ponto"], prompt: "Trabalhe leitura de eixos, escala, quadrantes, localização e deslocamento com coordenadas explicitamente verificáveis." },
  { id: "funcao-grafico", title: "Função e gráfico", keywords: ["funcao", "grafico", "dominio", "taxa"], prompt: "Relacione expressão, tabela, gráfico e situação; peça interpretação de domínio, variação e pontos relevantes." },
  { id: "geometria-visual", title: "Geometria visual", keywords: ["geometria", "area", "perimetro", "volume", "figura"], prompt: "Use desenho com medidas, unidades e decomposição; exija que o estudante explique a fórmula escolhida." },
  { id: "probabilidade-dados", title: "Probabilidade e dados", keywords: ["probabilidade", "estatistica", "media", "dados"], prompt: "Inclua tabela ou gráfico, peça leitura crítica, medida adequada e comunicação da incerteza sem confundir frequência com causa." },
  { id: "quimica-formulas", title: "Fórmulas químicas", keywords: ["quimica", "formula", "reacao", "mol"], prompt: "Apresente fórmulas com subscritos acessíveis, peça identificação de elementos e balanceamento ou interpretação conforme o nível." },
  { id: "tabela-periodica", title: "Tabela periódica", keywords: ["tabela periodica", "elemento", "periodo", "familia"], prompt: "Solicite localização, propriedades e tendências usando a tabela fornecida; não dependa de memorização isolada." },
  { id: "fisica-unidades", title: "Grandezas e unidades", keywords: ["fisica", "unidade", "medida", "velocidade", "forca"], prompt: "Peça identificação de grandezas, unidades, conversões e análise dimensional antes de aplicar a fórmula." },
  { id: "biologia-sistema", title: "Sistemas biológicos", keywords: ["biologia", "sistema", "celula", "organismo"], prompt: "Conecte estrutura, função e interação com o ambiente em vez de listar termos sem relação causal." },
  { id: "experimento-seguro", title: "Experimento seguro", keywords: ["experimento", "laboratorio", "seguranca", "procedimento"], prompt: "Organize materiais seguros, etapas, variável independente, controle, registro e descarte; sinalize riscos e alternativas sem laboratório." },
  { id: "codigo-pseudocodigo", title: "Código e pseudocódigo", keywords: ["codigo", "programacao", "algoritmo", "pseudocodigo"], prompt: "Peça decomposição do problema, entradas, saídas, casos-limite, teste manual e explicação da lógica antes da implementação." },
  { id: "depuracao", title: "Depuração", keywords: ["bug", "depurar", "erro de codigo", "debug"], prompt: "Forneça um erro reproduzível e solicite hipótese, teste, correção mínima e explicação da causa sem alterar o objetivo." },
  { id: "fluxograma", title: "Fluxograma", keywords: ["fluxograma", "processo", "decisao", "algoritmo"], prompt: "Represente início, entradas, decisões, repetições e saída; peça validação com um caso de teste." },
  { id: "planilha", title: "Planilha e dados", keywords: ["planilha", "celula", "formula", "tabela"], prompt: "Defina colunas, tipos de dados, fórmula, validação e uma pergunta interpretativa baseada na tabela." },
  { id: "estudo-caso-tecnico", title: "Estudo de caso técnico", keywords: ["estudo de caso", "empresa", "processo", "tecnico"], prompt: "Apresente contexto, restrições, evidências e decisão a tomar; avalie justificativa, viabilidade e consequências." },
  { id: "procedimento-operacional", title: "Procedimento operacional", keywords: ["procedimento", "rotina", "manual", "operacional"], prompt: "Organize pré-condições, sequência numerada, critérios de qualidade, exceções e registro de conclusão." },
  { id: "comparar-metodos", title: "Comparação de métodos", keywords: ["comparar", "metodo", "estrategia", "vantagem"], prompt: "Peça dois caminhos possíveis e compare precisão, custo, clareza, limites e quando escolher cada um." },
  { id: "sala-invertida", title: "Sala de aula invertida", keywords: ["sala invertida", "pre aula", "autonomo"], prompt: "Separe preparação curta, encontro de aplicação e síntese; inclua evidência de preparo sem punir quem precisa de apoio." },
  { id: "aprendizagem-colaborativa", title: "Aprendizagem colaborativa", keywords: ["grupo", "colaborativa", "pares", "equipe"], prompt: "Defina papéis, produto comum, responsabilidade individual, protocolo de revisão e critério de participação." },
  { id: "rubrica", title: "Rubrica de avaliação", keywords: ["rubrica", "criterio", "avaliacao", "desempenho"], prompt: "Crie critérios observáveis em quatro níveis, com descrições positivas, exemplos e pesos coerentes com o objetivo." },
  { id: "feedback-formativo", title: "Feedback formativo", keywords: ["feedback", "devolutiva", "melhorar"], prompt: "Escreva feedback específico que indique evidência, impacto e próximo passo; evite elogio genérico ou julgamento pessoal." },
  { id: "diferenciacao", title: "Diferenciação pedagógica", keywords: ["diferenciar", "nivel", "apoio", "desafio"], prompt: "Mantenha o mesmo objetivo e ofereça apoio, percurso regular e extensão, sem expor ou rotular estudantes." },
  { id: "acessibilidade", title: "Acessibilidade didática", keywords: ["acessibilidade", "inclusao", "adaptar", "leitura"], prompt: "Reduza barreiras por segmentação, linguagem direta, contraste, texto alternativo e opção de resposta equivalente." },
  { id: "trilha-progressiva", title: "Trilha progressiva", keywords: ["trilha", "percurso", "etapas", "progressao"], prompt: "Monte etapas do simples ao complexo, cada uma com objetivo, evidência de conclusão, interação e ponte para a próxima." },
  { id: "recuperacao-focal", title: "Recuperação focalizada", keywords: ["recuperacao", "reforco", "lacuna", "dificuldade"], prompt: "Parta da habilidade com menor evidência, modele uma estratégia, proponha prática guiada e finalize com aplicação independente." },
  { id: "revisao-avaliacao", title: "Revisão de avaliação", keywords: ["revisar prova", "qualidade", "questao", "avaliacao"], prompt: "Verifique alinhamento, ambiguidade, distribuição de dificuldade, gabarito, acessibilidade e tempo estimado." },
  { id: "plano-aula", title: "Plano de aula", keywords: ["plano de aula", "objetivo", "metodologia", "aula"], prompt: "Organize objetivo observável, ativação, modelagem, prática, avaliação rápida, recursos, tempo e fechamento." },
  { id: "recurso-interativo", title: "Recurso interativo", keywords: ["interativo", "simulacao", "visualizacao", "atividade digital"], prompt: "Defina o que o estudante manipula, qual hipótese testa, que feedback recebe e que registro produz." },
];

export const GENERAL_PROMPT_CASES = cases;
const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export const selectGeneralPromptCases = ({ objective, subject, skills, allFormatsEnabled }: { objective: string; subject: string; skills: Array<{ codigo?: unknown; descricao?: unknown }>; allFormatsEnabled: boolean }) => {
  const context = normalize([objective, subject, ...skills.map((skill) => `${skill.codigo || ""} ${skill.descricao || ""}`)].join(" "));
  const ranked = cases.map((item, index) => ({ item, index, score: item.keywords.reduce((total, keyword) => total + (context.includes(normalize(keyword)) ? 3 : 0), 0) })).sort((a, b) => b.score - a.score || a.index - b.index);
  const limit = allFormatsEnabled ? 8 : 4;
  const selected = ranked.filter((entry) => entry.score > 0).slice(0, limit);
  for (const fallback of ranked) { if (selected.length >= limit) break; if (!selected.some((entry) => entry.item.id === fallback.item.id)) selected.push(fallback); }
  return selected.map(({ item }) => item);
};
