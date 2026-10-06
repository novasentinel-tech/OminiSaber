export type PortuguesePromptCase = {
  id: string;
  title: string;
  keywords: string[];
  prompt: string;
};

const cases: Array<[string, string, string[], string]> = [
  ["leitura-literal", "Localização de informação explícita", ["informacao explicita", "localizar", "literal"], "Construa itens que exijam localizar e relacionar informações explicitamente presentes no texto, sem depender de conhecimento externo."],
  ["leitura-inferencial", "Inferência textual", ["inferencia", "inferir", "implicito"], "Crie situações em que a resposta resulte de pistas textuais verificáveis; a explicação deve indicar quais pistas sustentam a inferência."],
  ["tema-ideia-central", "Tema e ideia central", ["tema", "ideia central", "assunto principal"], "Diferencie tema, recorte temático e ideia central, evitando alternativas que sejam apenas palavras soltas do texto."],
  ["finalidade-textual", "Finalidade e intenção comunicativa", ["finalidade", "intencao", "objetivo do texto"], "Peça ao estudante que reconheça a finalidade comunicativa e a relacione ao gênero, ao público e ao contexto de circulação."],
  ["fato-opiniao", "Fato e opinião", ["fato", "opiniao", "ponto de vista"], "Use enunciados curtos para distinguir fatos verificáveis de opiniões ou avaliações, justificando linguisticamente a classificação."],
  ["referenciacao", "Referência pronominal", ["referencia", "pronome", "retomada"], "Avalie a identificação do referente de pronomes e expressões anafóricas, preservando contexto suficiente para eliminar ambiguidades."],
  ["coesao-sequencial", "Coesão sequencial", ["coesao", "conectivo", "articulador"], "Explore o efeito de conectivos na progressão do texto e peça substituições que preservem a relação semântica original."],
  ["coerencia", "Coerência global", ["coerencia", "contradicao", "sentido global"], "Proponha análise da coerência global, incluindo contradições, lacunas e compatibilidade entre informações do texto."],
  ["vocabulario-contexto", "Vocabulário em contexto", ["vocabulario", "sentido", "palavra no contexto"], "Solicite o sentido contextual de palavra ou expressão e ofereça distratores plausíveis vindos de outros sentidos dicionarizados."],
  ["leitura-multimodal", "Leitura multimodal", ["multimodal", "imagem", "linguagem verbal e nao verbal"], "Integre texto verbal e elemento visual; a questão deve exigir leitura conjunta, sem deixar a resposta dependente apenas de um dos modos."],
  ["comparacao-textos", "Comparação entre textos", ["comparar textos", "intertextualidade", "dois textos"], "Compare tratamento, posicionamento ou recursos de dois textos sobre tema comum, explicitando o critério de comparação."],
  ["confiabilidade-fontes", "Confiabilidade de fontes", ["fonte", "confiabilidade", "desinformacao"], "Crie um caso de verificação de fonte que considere autoria, evidências, data, veículo e possibilidade de confirmação independente."],
  ["tese", "Identificação da tese", ["tese", "posicionamento", "argumentacao"], "Peça a identificação da tese e diferencie-a do tema, de exemplos e de informações de apoio."],
  ["argumentos", "Relação entre tese e argumentos", ["argumento", "tese", "sustentar"], "Avalie se cada argumento sustenta de fato a tese e peça justificativa baseada na relação lógica entre ambos."],
  ["evidencias", "Qualidade das evidências", ["evidencia", "dado", "fonte"], "Solicite avaliação da pertinência e suficiência de dados, exemplos ou autoridades usados como evidência."],
  ["contra-argumento", "Contra-argumentação", ["contra-argumento", "refutacao", "ponto de vista contrario"], "Proponha a formulação ou análise de contra-argumento respeitoso, diretamente ligado à tese e seguido de possível refutação."],
  ["falacias", "Falácias argumentativas", ["falacia", "generalizacao", "argumento invalido"], "Apresente raciocínios curtos para reconhecer falácias frequentes e peça uma reformulação argumentativamente válida."],
  ["artigo-opiniao", "Artigo de opinião", ["artigo de opiniao", "opiniao", "editorial"], "Estruture a atividade em tese, argumentos, evidências, contra-argumento e conclusão, considerando público e veículo de circulação."],
  ["debate", "Debate regrado", ["debate", "oralidade", "turno de fala"], "Crie uma preparação para debate com posição, evidências, perguntas, réplica e critérios de escuta e respeito aos turnos."],
  ["noticia", "Notícia", ["noticia", "lide", "jornalismo"], "Trabalhe lide, fato principal, fontes e distinção entre informação e avaliação; não invente dados apresentados como reais."],
  ["reportagem", "Reportagem", ["reportagem", "jornalismo", "fontes"], "Explore aprofundamento do tema, diversidade de fontes, contextualização e diferença estrutural entre notícia e reportagem."],
  ["cronica", "Crônica", ["cronica", "cotidiano", "narrador"], "Analise como uma situação cotidiana é transformada por ponto de vista, humor, lirismo ou crítica social."],
  ["conto", "Conto", ["conto", "narrativa", "conflito"], "Construa questões sobre conflito, foco narrativo, personagens, tempo, espaço e efeito do desfecho com base no texto fornecido."],
  ["poema", "Poema", ["poema", "eu lirico", "verso"], "Explore eu lírico, imagens, ritmo e efeitos sonoros sem reduzir a leitura poética a uma única paráfrase literal."],
  ["cordel", "Literatura de cordel", ["cordel", "sextilha", "oralidade"], "Relacione forma, ritmo, oralidade, tema e contexto cultural do cordel, evitando estereótipos regionais."],
  ["carta", "Carta pessoal ou argumentativa", ["carta", "destinatario", "remetente"], "Considere interlocutor, finalidade, vocativo, desenvolvimento e fechamento adequados ao tipo de carta solicitado."],
  ["email", "E-mail formal", ["email", "correio eletronico", "formal"], "Avalie assunto, saudação, clareza do pedido, tom, concisão e despedida em uma situação comunicativa realista."],
  ["publicidade", "Anúncio publicitário", ["publicidade", "propaganda", "anuncio"], "Analise público-alvo, promessa, recursos persuasivos, relação verbal-visual e possíveis implicações éticas."],
  ["infografico", "Infográfico", ["infografico", "grafico", "dados visuais"], "Peça integração de títulos, legendas, escalas, ícones e dados, incluindo uma conclusão que dependa da leitura do conjunto."],
  ["meme", "Meme e humor digital", ["meme", "humor", "internet"], "Explore conhecimento compartilhado, intertextualidade e efeito de humor, sem depender de referência inacessível ao estudante."],
  ["podcast", "Roteiro de podcast", ["podcast", "roteiro", "audio"], "Organize abertura, apresentação do tema, blocos, transições, marcas de oralidade planejada e encerramento."],
  ["entrevista", "Entrevista", ["entrevista", "pergunta", "entrevistado"], "Diferencie perguntas abertas e fechadas, ordene a progressão temática e avalie escuta, retomada e adequação ao entrevistado."],
  ["resenha", "Resenha crítica", ["resenha", "critica", "obra"], "Equilibre apresentação da obra, síntese seletiva, avaliação fundamentada e recomendação coerente ao público."],
  ["resumo", "Resumo", ["resumo", "sintese", "ideias principais"], "Exija seleção das ideias essenciais, fidelidade ao texto-base, concisão e ausência de opinião pessoal não solicitada."],
  ["substantivo-adjetivo", "Substantivos e adjetivos", ["substantivo", "adjetivo", "classe de palavras"], "Trabalhe função e efeito de substantivos e adjetivos em frases contextualizadas, não apenas nomenclatura isolada."],
  ["pronomes", "Pronomes", ["pronomes", "pronome", "colocacao pronominal"], "Avalie referência, adequação e, quando pertinente, colocação pronominal em usos reais da língua."],
  ["verbos", "Tempos e modos verbais", ["verbo", "tempo verbal", "modo verbal"], "Relacione tempo e modo verbal ao efeito de certeza, hipótese, ordem, continuidade ou anterioridade no texto."],
  ["concordancia-verbal", "Concordância verbal", ["concordancia verbal", "sujeito", "verbo"], "Use casos contextualizados de concordância verbal, incluindo sujeito composto, coletivo ou posposto conforme a série."],
  ["concordancia-nominal", "Concordância nominal", ["concordancia nominal", "adjetivo", "nome"], "Proponha revisão de concordância nominal em trechos autênticos e peça explicação da relação entre os termos."],
  ["regencia", "Regência verbal e nominal", ["regencia", "preposicao", "complemento"], "Explore a preposição exigida e mudanças de sentido provocadas pela regência, evitando exemplos artificiais."],
  ["crase", "Uso da crase", ["crase", "a grave", "regencia"], "Apresente contextos em que o estudante possa testar regência e presença de artigo, incluindo casos proibidos e facultativos adequados ao nível."],
  ["pontuacao", "Pontuação", ["pontuacao", "virgula", "dois pontos"], "Relacione sinais de pontuação à organização sintática e aos efeitos de sentido, não apenas a pausas na fala."],
  ["acentuacao", "Acentuação gráfica", ["acentuacao", "oxitona", "hiato"], "Combine identificação da tonicidade, aplicação de regra e revisão de palavras em contexto."],
  ["ortografia", "Ortografia", ["ortografia", "grafia", "escrita correta"], "Use pares e padrões ortográficos em frases significativas; peça revisão com justificativa sempre que possível."],
  ["formacao-palavras", "Formação de palavras", ["prefixo", "sufixo", "formacao de palavras"], "Explore derivação, composição e contribuição de morfemas para o sentido em vocabulário contextualizado."],
  ["termos-oracao", "Termos da oração", ["sujeito", "predicado", "objeto direto", "termos da oracao"], "Analise a função sintática dos termos e conecte a análise a clareza, ênfase ou ambiguidade do enunciado."],
  ["coordenacao", "Orações coordenadas", ["coordenacao", "oracao coordenada", "conjuncao"], "Peça reconhecimento da relação semântica entre orações coordenadas e reescrita com conectivo equivalente."],
  ["subordinacao", "Orações subordinadas", ["subordinacao", "oracao subordinada", "periodo composto"], "Relacione a oração subordinada à função desempenhada e ao efeito de sentido no período completo."],
  ["ambiguidade", "Ambiguidade", ["ambiguidade", "duplo sentido", "clareza"], "Apresente ambiguidade lexical ou sintática identificável e solicite duas leituras e uma reescrita inequívoca."],
  ["figuras-linguagem", "Figuras de linguagem", ["metafora", "ironia", "figura de linguagem"], "Avalie o efeito expressivo da figura no contexto; evite questões que cobrem apenas o nome da figura."],
  ["variacao-linguistica", "Variação linguística", ["variacao linguistica", "dialeto", "preconceito linguistico"], "Trate variedades como adequadas a contextos distintos, diferencie variação de erro de digitação e combata preconceito linguístico."],
  ["registro", "Registro formal e informal", ["registro", "formal", "informal"], "Proponha adequação de linguagem a interlocutor, objetivo, canal e situação, sem classificar informalidade como inferior."],
  ["trovadorismo", "Trovadorismo", ["trovadorismo", "cantiga", "medieval"], "Relacione tipos de cantiga, voz poética e contexto de produção, usando fragmentos suficientes para análise."],
  ["humanismo", "Humanismo", ["humanismo", "gil vicente", "transicao medieval"], "Explore transição cultural, teatro vicentino e crítica de tipos sociais com apoio em texto ou situação histórica."],
  ["classicismo", "Classicismo", ["classicismo", "camoes", "renascimento"], "Analise equilíbrio formal, referências clássicas e visão renascentista em fragmentos contextualizados."],
  ["barroco", "Barroco", ["barroco", "gregorio de matos", "contraste"], "Trabalhe dualidade, contraste, conceptismo e cultismo a partir de marcas observáveis no texto."],
  ["arcadismo", "Arcadismo", ["arcadismo", "bucolismo", "inconfidencia"], "Relacione convenções árcades, pastoralismo e contexto histórico sem transformar a atividade em memorização de datas."],
  ["romantismo", "Romantismo", ["romantismo", "nacionalismo", "indianismo"], "Compare gerações, projetos de identidade e construção de subjetividade por meio de fragmentos e contexto."],
  ["realismo-naturalismo", "Realismo e Naturalismo", ["realismo", "naturalismo", "machado de assis"], "Explore crítica social, narrador, ironia e diferenças de abordagem entre Realismo e Naturalismo."],
  ["parnasianismo-simbolismo", "Parnasianismo e Simbolismo", ["parnasianismo", "simbolismo", "musicalidade"], "Compare forma, objetividade, sugestão, musicalidade e imagens poéticas em textos representativos."],
  ["modernismo", "Modernismo", ["modernismo", "semana de 22", "ruptura"], "Analise ruptura estética, linguagem brasileira e projetos das fases modernistas a partir de obras ou manifestos."],
  ["literatura-contemporanea", "Literatura contemporânea", ["literatura contemporanea", "contemporaneo", "periferica"], "Inclua diversidade de vozes, suportes e temas contemporâneos, contextualizando autoria sem estereotipar identidades."],
  ["planejamento-redacao", "Planejamento de redação", ["planejamento", "redacao", "projeto de texto"], "Oriente delimitação do tema, tese, repertório, sequência de argumentos e finalidade antes da escrita do texto completo."],
  ["introducao-redacao", "Introdução argumentativa", ["introducao", "redacao", "contextualizacao"], "Peça introdução que contextualize o recorte e apresente tese clara, evitando fórmulas prontas e generalizações vazias."],
  ["desenvolvimento-redacao", "Parágrafo de desenvolvimento", ["desenvolvimento", "topico frasal", "argumento"], "Estruture tópico frasal, explicação, evidência e fechamento articulado à tese em um parágrafo coeso."],
  ["conclusao-redacao", "Conclusão e proposta", ["conclusao", "proposta de intervencao", "redacao enem"], "Construa fechamento coerente com a tese e, quando cabível, proposta detalhada, viável e respeitosa aos direitos humanos."],
  ["revisao-textual", "Revisão textual", ["revisao", "reescrita", "melhorar texto"], "Priorize uma rodada de revisão por conteúdo e organização antes da revisão linguística; peça justificativa para mudanças relevantes."],
  ["parafrase", "Paráfrase", ["parafrase", "reescrever", "texto fonte"], "Solicite reescrita fiel às ideias da fonte com estrutura própria, distinguindo paráfrase de cópia ou simples troca de sinônimos."],
  ["citacao", "Citação e integração de fontes", ["citacao", "fonte", "plagio"], "Avalie como introduzir, contextualizar e comentar uma citação, deixando clara a autoria e a função argumentativa."],
  ["repertorio", "Repertório sociocultural", ["repertorio", "referencia", "redacao"], "Peça repertório pertinente, explicado e conectado ao argumento; rejeite referência decorativa ou não verificável."],
  ["oralidade", "Marcas de oralidade", ["oralidade", "fala", "lingua falada"], "Analise marcas da fala e sua transposição para diferentes gêneros, respeitando variação e contexto de uso."],
  ["seminario", "Seminário", ["seminario", "apresentacao oral", "exposicao"], "Planeje abertura, sequência de ideias, apoio visual, divisão de falas, gestão do tempo e resposta a perguntas."],
  ["leitura-fluencia", "Fluência e leitura expressiva", ["fluencia", "leitura expressiva", "prosodia"], "Crie preparação de leitura que considere ritmo, pausas, entonação e compreensão, sem expor individualmente o estudante."],
  ["diagnostico", "Avaliação diagnóstica", ["diagnostica", "diagnostico", "conhecimentos previos"], "Distribua questões de complexidade crescente para revelar estratégias e conhecimentos prévios, não apenas contabilizar acertos."],
  ["recuperacao", "Recuperação focalizada", ["recuperacao", "reforco", "dificuldade"], "Comece por uma tarefa guiada, ofereça pista ou modelo e avance para aplicação autônoma na mesma habilidade."],
  ["adaptacao-acessivel", "Adaptação acessível", ["acessibilidade", "adaptacao", "inclusao"], "Reduza barreiras de leitura com instruções diretas, segmentação, exemplos e alternativas equivalentes, preservando o objetivo curricular."],
  ["sequencia-didatica", "Sequência didática", ["sequencia didatica", "etapas", "progressao"], "Organize ativação de conhecimentos prévios, modelagem, prática guiada, prática autônoma e síntese avaliativa."],
];

export const PORTUGUESE_PROMPT_CASES: PortuguesePromptCase[] = cases.map(
  ([id, title, keywords, prompt]) => ({ id, title, keywords, prompt }),
);

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

export const selectPortuguesePromptCases = ({
  objective,
  skills,
  questionTypes,
  category,
  difficulty,
  allFormatsEnabled,
}: {
  objective: string;
  skills: Array<{ codigo?: unknown; descricao?: unknown }>;
  questionTypes: string[];
  category: string;
  difficulty: string;
  allFormatsEnabled: boolean;
}) => {
  const context = normalize(
    [objective, category, difficulty, questionTypes.join(" "), ...skills.map((skill) => `${skill.codigo || ""} ${skill.descricao || ""}`)].join(" "),
  );
  const ranked = PORTUGUESE_PROMPT_CASES.map((item, index) => ({
    item,
    index,
    score: item.keywords.reduce((total, keyword) => total + (context.includes(normalize(keyword)) ? 3 : 0), 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  const limit = allFormatsEnabled ? 8 : 4;
  const selected = ranked.filter((entry) => entry.score > 0).slice(0, limit);
  for (const fallback of ranked) {
    if (selected.length >= limit) break;
    if (!selected.some((entry) => entry.item.id === fallback.item.id)) selected.push(fallback);
  }
  return selected.map(({ item }) => item);
};

