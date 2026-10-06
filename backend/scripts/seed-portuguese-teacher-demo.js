import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const publicKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !serviceKey || !publicKey)
  throw new Error("Configuração do Supabase incompleta no .env.");

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = () =>
  createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const teacherCredentials = {
  email: "professor.portugues.teste@ominisaber.com.br",
  password: "senha123profportugues",
  registration: "userprofportugues",
};
const studentCredentials = [1, 2, 3].map((number) => ({
  email: `aluno${number}.teste@ominisaber.com.br`,
  password: "senha123aluno",
  registration: number === 1 ? "useraluno" : `useraluno${number}`,
  name: ["Ana Clara Souza", "Bruno Mendes Lima", "Carla Oliveira Santos"][
    number - 1
  ],
}));
const classId = "d2400000-0000-4000-8000-000000000001";
const labIds = [
  "d2400000-0000-4000-8000-000000000011",
  "d2400000-0000-4000-8000-000000000012",
];
const proposalId = "d2400000-0000-4000-8000-000000000020";
const essayIds = [
  "d2400000-0000-4000-8000-000000000021",
  "d2400000-0000-4000-8000-000000000022",
];
const eventIds = [
  "d2400000-0000-4000-8000-000000000031",
  "d2400000-0000-4000-8000-000000000032",
  "d2400000-0000-4000-8000-000000000033",
];

const findUser = async (email) => {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const found = data.users.find((user) => user.email === email);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
};

const ensureUser = async ({
  email,
  password,
  registration,
  name,
  role,
  teacherType = null,
  course = null,
}) => {
  const metadata = {
    nome: name,
    matricula: registration,
    role,
    ...(teacherType ? { tipo_professor: teacherType } : {}),
    ...(course ? { curso_tecnico: course } : {}),
  };
  let user = await findUser(email);
  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { ominisaber_role: role },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { ominisaber_role: role },
    });
    if (error) throw error;
    user = data.user;
  }
  const profile = await admin
    .from("perfis")
    .update({
      nome: name,
      matricula: registration,
      role,
      tipo_professor: teacherType,
      curso_tecnico: course,
      turma_id: null,
      ativo: true,
    })
    .eq("id", user.id)
    .select("id")
    .single();
  if (profile.error) throw profile.error;
  return user.id;
};

const teacherId = await ensureUser({
  ...teacherCredentials,
  name: "Professora Helena Duarte",
  role: "professor",
  teacherType: "portugues",
});
const studentIds = [];
for (const credentials of studentCredentials) {
  studentIds.push(
    await ensureUser({
      ...credentials,
      role: "aluno",
      course: "informatica",
    }),
  );
}

const classResult = await admin.from("turmas").upsert({
  id: classId,
  nome: "1º Ano A · Informática",
  ano_letivo: 2026,
  serie: "1",
});
if (classResult.error) throw classResult.error;
await admin.from("perfis").update({ turma_id: classId }).in("id", studentIds);

const legacyLink = await admin
  .from("professor_turmas")
  .upsert(
    { professor_id: teacherId, turma_id: classId, materia: "portugues" },
    { onConflict: "professor_id,turma_id" },
  );
if (legacyLink.error) throw legacyLink.error;
const canonicalLink = await admin.from("professor_turma_materias").upsert(
  {
    professor_id: teacherId,
    turma_id: classId,
    materia_codigo: "portugues",
    ativo: true,
  },
  { onConflict: "professor_id,turma_id,materia_codigo" },
);
if (canonicalLink.error) throw canonicalLink.error;

const teacher = publicClient();
const teacherLogin = await teacher.auth.signInWithPassword({
  email: teacherCredentials.email,
  password: teacherCredentials.password,
});
if (teacherLogin.error) throw teacherLogin.error;

const skillsResult = await teacher.rpc("buscar_habilidades_curriculares", {
  p_materia: "portugues",
  p_serie: 1,
  p_trimestre: 1,
  p_busca: null,
});
if (skillsResult.error) throw skillsResult.error;
const skills = (skillsResult.data || []).slice(0, 3);
if (!skills.length)
  throw new Error("O catálogo de Português não possui habilidades publicadas.");

let evaluationResult = await teacher
  .from("avaliacoes_docentes")
  .select("id")
  .eq("professor_id", teacherId)
  .contains("configuracao", { seed_key: "demo-portugues-fase-24" })
  .maybeSingle();
if (evaluationResult.error) throw evaluationResult.error;
let evaluationId = evaluationResult.data?.id;
if (!evaluationId) {
  const created = await teacher.rpc("criar_atividade_docente", {
    p_payload: {
      title: "Leitura crítica e argumentação",
      instructions:
        "Leia cada situação comunicativa e identifique a estratégia linguística mais adequada.",
      duration: 45,
      value: 10,
      classId,
      subject: "portugues",
      category: "avaliacao",
      series: 1,
      trimester: 1,
      scoringMode: "igual",
      attempts: 1,
      shuffleQuestions: false,
      shuffleAlternatives: false,
      immediateFeedback: true,
      showAnswerKey: true,
      configuration: { seed_key: "demo-portugues-fase-24" },
      publish: true,
      questions: [
        {
          type: "unica_escolha",
          statement:
            "Em um artigo de opinião, qual elemento apresenta diretamente o posicionamento central do autor?",
          alternatives: ["A tese", "A referência", "O título", "A assinatura"],
          answer: "A tese",
          explanation: "A tese sintetiza o ponto de vista defendido no texto.",
          skillIds: [skills[0].habilidade_id],
          required: true,
        },
        {
          type: "unica_escolha",
          statement:
            "Qual conectivo estabelece uma relação de oposição entre duas ideias?",
          alternatives: ["Portanto", "Além disso", "Entretanto", "Porque"],
          answer: "Entretanto",
          explanation: "Entretanto introduz uma ideia contrastante.",
          skillIds: [skills[Math.min(1, skills.length - 1)].habilidade_id],
          required: true,
        },
        {
          type: "unica_escolha",
          statement:
            "Em uma notícia, a separação entre fato e opinião contribui principalmente para quê?",
          alternatives: [
            "Aumentar o tamanho do texto",
            "Avaliar criticamente a informação",
            "Eliminar as fontes",
            "Substituir o título",
          ],
          answer: "Avaliar criticamente a informação",
          explanation:
            "Reconhecer fato e opinião ajuda o leitor a avaliar evidências e posicionamentos.",
          skillIds: [skills[Math.min(2, skills.length - 1)].habilidade_id],
          required: true,
        },
      ],
    },
  });
  if (created.error) throw created.error;
  evaluationId = created.data;
}

const questionsResult = await admin
  .from("questoes_avaliacao")
  .select("id,ordem")
  .eq("avaliacao_id", evaluationId)
  .order("ordem");
if (questionsResult.error) throw questionsResult.error;
const correctAnswers = [
  "A tese",
  "Entretanto",
  "Avaliar criticamente a informação",
];
const studentAnswerSets = [
  correctAnswers,
  ["A tese", "Portanto", "Aumentar o tamanho do texto"],
];
for (let index = 0; index < 2; index += 1) {
  const student = publicClient();
  const login = await student.auth.signInWithPassword({
    email: studentCredentials[index].email,
    password: studentCredentials[index].password,
  });
  if (login.error) throw login.error;
  const existing = await student
    .from("tentativas_avaliacao")
    .select("id,status")
    .eq("avaliacao_id", evaluationId)
    .eq("aluno_id", studentIds[index])
    .order("numero_tentativa", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) {
    const started = await student.rpc("iniciar_tentativa_avaliacao", {
      p_avaliacao_id: evaluationId,
    });
    if (started.error) throw started.error;
    for (const [questionIndex, question] of questionsResult.data.entries()) {
      const saved = await student.rpc("salvar_resposta_avaliacao", {
        p_tentativa_id: started.data,
        p_questao_id: question.id,
        p_resposta: studentAnswerSets[index][questionIndex],
      });
      if (saved.error) throw saved.error;
    }
    const submitted = await student.rpc("entregar_tentativa_avaliacao", {
      p_tentativa_id: started.data,
    });
    if (submitted.error) throw submitted.error;
  }
  await student.auth.signOut();
}

const future = (days, hour) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const labs = await admin.from("laboratorios_docentes").upsert([
  {
    id: labIds[0],
    professor_id: teacherId,
    turma_id: classId,
    tipo_professor: "portugues",
    titulo: "Laboratório de vozes e pontos de vista",
    descricao:
      "Leitura colaborativa para reconhecer narrador, interlocução e marcas de posicionamento.",
    formato: "oficina",
    configuracao: { seed_key: "demo-portugues-lab-1" },
    status: "publicado",
    prazo: future(7, 18),
    publicado_em: new Date().toISOString(),
  },
  {
    id: labIds[1],
    professor_id: teacherId,
    turma_id: classId,
    tipo_professor: "portugues",
    titulo: "Mapa da argumentação",
    descricao:
      "Organização visual de tese, argumentos, evidências e contra-argumentos.",
    formato: "mapa_interativo",
    configuracao: { seed_key: "demo-portugues-lab-2" },
    status: "rascunho",
    prazo: future(14, 18),
  },
]);
if (labs.error) throw labs.error;

const delivery = await admin.from("entregas_laboratorio").upsert({
  id: "d2400000-0000-4000-8000-000000000013",
  laboratorio_id: labIds[0],
  aluno_id: studentIds[0],
  conteudo: { observacao: "Identificou corretamente narrador e tese." },
  status: "enviada",
  enviada_em: new Date().toISOString(),
});
if (delivery.error) throw delivery.error;

const prompt = await admin.from("propostas_redacao").upsert({
  id: proposalId,
  titulo: "Desinformação e responsabilidade digital",
  categoria: "Cidadania digital",
  comando:
    "Produza um texto dissertativo-argumentativo sobre os caminhos para combater a desinformação entre jovens.",
  textos_motivadores: [
    {
      titulo: "Contexto",
      texto:
        "A circulação acelerada de conteúdos exige leitura crítica, verificação de fontes e responsabilidade coletiva.",
    },
  ],
  professor_id: teacherId,
  turma_id: classId,
  prazo: future(10, 23),
  publicada: true,
  fixada: true,
  resumo: "Leitura crítica, cidadania e circulação de informações.",
  eixo_tematico: "Tecnologia e sociedade",
  dificuldade: "intermediaria",
  tempo_estimado_min: 90,
  palavras_chave: ["desinformação", "juventude", "cidadania digital"],
  detalhes: { seed_key: "demo-portugues-redacao" },
});
if (prompt.error) throw prompt.error;

const essays = await admin.from("redacoes").upsert([
  {
    id: essayIds[0],
    aluno_id: studentIds[0],
    proposta_id: proposalId,
    tema_codigo: "demo-desinformacao-2026",
    titulo: "Educação midiática e cidadania",
    texto:
      "A desinformação interfere na participação cidadã e na tomada de decisões. Por isso, a escola deve promover leitura crítica e verificação de fontes.\n\nAlém disso, plataformas e famílias precisam orientar o uso responsável das redes. A cooperação entre esses agentes reduz o compartilhamento impulsivo.\n\nPortanto, projetos de educação midiática devem integrar o currículo escolar, com oficinas práticas e acompanhamento docente.",
    status: "enviada",
    enviada_em: new Date().toISOString(),
    enviada_para_revisao_em: new Date().toISOString(),
  },
  {
    id: essayIds[1],
    aluno_id: studentIds[1],
    proposta_id: proposalId,
    tema_codigo: "demo-desinformacao-2026-b",
    titulo: "Informação exige responsabilidade",
    texto:
      "O acesso à informação não garante compreensão. É necessário avaliar autoria, contexto e evidências antes de compartilhar conteúdos.\n\nNesse sentido, ações educativas podem fortalecer a autonomia dos jovens e prevenir danos coletivos.",
    status: "enviada",
    enviada_em: future(-2, 18),
  },
]);
if (essays.error) throw essays.error;

const demoCompetencies = [
  [1, 160, "Bom domínio da norma-padrão."],
  [2, 160, "Tema compreendido e tese bem delimitada."],
  [3, 160, "Argumentos pertinentes; amplie o repertório."],
  [4, 160, "Boa articulação entre as ideias."],
  [5, 120, "Detalhe melhor os meios da intervenção."],
].map(([competencia, nota, comentario]) => ({
  redacao_id: essayIds[1],
  competencia,
  nota,
  comentario,
  professor_id: teacherId,
}));
const savedCompetencies = await admin
  .from("avaliacoes_competencias_redacao")
  .upsert(demoCompetencies, { onConflict: "redacao_id,competencia" });
if (savedCompetencies.error) throw savedCompetencies.error;

const correctedEssay = await admin
  .from("redacoes")
  .update({
    status: "corrigida",
    nota: 760,
    feedback:
      "Boa tese e progressão temática. Desenvolva melhor o repertório e detalhe a proposta de intervenção.",
    corrigida_por: teacherId,
    corrigida_em: new Date().toISOString(),
  })
  .eq("id", essayIds[1]);
if (correctedEssay.error) throw correctedEssay.error;

const events = await admin.from("eventos_agenda").upsert([
  {
    id: eventIds[0],
    titulo: "Avaliação de leitura crítica",
    descricao: "Avaliação vinculada aos descritores do primeiro trimestre.",
    tipo: "prova",
    inicio: future(3, 8),
    fim: future(3, 9),
    materia: "Língua Portuguesa",
    local: "Sala 01",
    turma_id: classId,
    professor_id: teacherId,
    status: "publicado",
  },
  {
    id: eventIds[1],
    titulo: "Entrega da produção argumentativa",
    descricao: "Versão final da proposta sobre responsabilidade digital.",
    tipo: "trabalho",
    inicio: future(10, 18),
    materia: "Língua Portuguesa",
    turma_id: classId,
    professor_id: teacherId,
    status: "publicado",
  },
  {
    id: eventIds[2],
    titulo: "Recuperação por descritores",
    descricao: "Revisão focada nas habilidades de menor desempenho.",
    tipo: "recuperacao",
    inicio: future(17, 8),
    fim: future(17, 9),
    materia: "Língua Portuguesa",
    local: "Laboratório de Linguagens",
    turma_id: classId,
    professor_id: teacherId,
    status: "publicado",
  },
]);
if (events.error) throw events.error;

const authenticatedVerification = await Promise.all([
  teacher
    .from("professor_turma_materias")
    .select("turma_id,materia_codigo")
    .eq("professor_id", teacherId),
  teacher
    .from("avaliacoes_docentes")
    .select("id,titulo,status")
    .eq("professor_id", teacherId),
  teacher
    .from("questoes_avaliacao_habilidades")
    .select("questao_id,habilidade_id")
    .in(
      "questao_id",
      (questionsResult.data || []).map((question) => question.id),
    ),
  teacher
    .from("laboratorios_docentes")
    .select(
      "*, turmas!laboratorios_docentes_turma_id_fkey(id,nome,serie), entregas_laboratorio(id,status,nota)",
    )
    .eq("professor_id", teacherId),
  teacher
    .from("redacoes")
    .select(
      "*, perfis!redacoes_aluno_id_fkey(nome,turma_id,turmas!perfis_turma_id_fkey(id,nome,serie)), propostas_redacao!redacoes_proposta_id_fkey(id,titulo,prazo,categoria)",
    )
    .in("aluno_id", studentIds),
  teacher
    .from("eventos_agenda")
    .select(
      "*, turmas!eventos_agenda_turma_id_fkey(id,nome,serie), perfis!eventos_agenda_professor_id_fkey(id,nome,tipo_professor)",
    )
    .eq("professor_id", teacherId),
]);
for (const result of authenticatedVerification) {
  if (result.error) throw result.error;
}

await teacher.auth.signOut();

const verification = await Promise.all([
  admin
    .from("laboratorios_docentes")
    .select("id", { count: "exact", head: true })
    .eq("professor_id", teacherId),
  admin
    .from("avaliacoes_docentes")
    .select("id", { count: "exact", head: true })
    .eq("professor_id", teacherId),
  admin
    .from("redacoes")
    .select("id", { count: "exact", head: true })
    .in("aluno_id", studentIds),
  admin
    .from("eventos_agenda")
    .select("id", { count: "exact", head: true })
    .eq("professor_id", teacherId),
]);
for (const result of verification) if (result.error) throw result.error;

console.log(
  JSON.stringify(
    {
      projeto: new URL(url).hostname.split(".")[0],
      professor: teacherCredentials.registration,
      senhaProfessor: teacherCredentials.password,
      alunos: studentCredentials.map((item) => item.registration),
      senhaAlunos: studentCredentials[0].password,
      turma: "1º Ano A · Informática",
      laboratorios: verification[0].count,
      avaliacoes: verification[1].count,
      redacoes: verification[2].count,
      eventos: verification[3].count,
      leituraAutenticada: {
        vinculos: authenticatedVerification[0].data?.length || 0,
        avaliacoes: authenticatedVerification[1].data?.length || 0,
        habilidadesVinculadas: authenticatedVerification[2].data?.length || 0,
        laboratorios: authenticatedVerification[3].data?.length || 0,
        redacoes: authenticatedVerification[4].data?.length || 0,
        eventos: authenticatedVerification[5].data?.length || 0,
      },
    },
    null,
    2,
  ),
);
