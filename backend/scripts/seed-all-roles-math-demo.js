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

const expectedProject = "mvnuhwlnbhijjlosmnfv";
const configuredProject = new URL(url).hostname.split(".")[0];
if (configuredProject !== expectedProject)
  throw new Error(
    `O .env aponta para ${configuredProject}, mas o seed foi preparado para ${expectedProject}.`,
  );

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = () =>
  createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const accounts = [
  {
    email: "professor.matematica.teste@ominisaber.com.br",
    password: "senha123profmatematica",
    registration: "userprofmatematica",
    name: "Professor Marcos Almeida",
    role: "professor",
    teacherType: "matematica",
  },
  {
    email: "professor.portugues.teste@ominisaber.com.br",
    password: "senha123profportugues",
    registration: "userprofportugues",
    name: "Professora Helena Duarte",
    role: "professor",
    teacherType: "portugues",
  },
  {
    email: "professor.administracao.teste@ominisaber.com.br",
    password: "senha123profadministracao",
    registration: "userprofadministracao",
    name: "Professora Renata Nogueira",
    role: "professor",
    teacherType: "tecnico_administracao",
  },
  {
    email: "professor.informatica.teste@ominisaber.com.br",
    password: "senha123profinformatica",
    registration: "userprofinformatica",
    name: "Professor Diego Martins",
    role: "professor",
    teacherType: "tecnico_informatica",
  },
  {
    email: "gestor.teste@ominisaber.com.br",
    password: "senha123gestor",
    registration: "usergestor",
    name: "Gestora Sofia Ribeiro",
    role: "gestor",
  },
  {
    email: "bibliotecaria.teste@ominisaber.com.br",
    password: "senha123bibliotecaria",
    registration: "userbibliotecaria",
    name: "Bibliotecária Beatriz Costa",
    role: "bibliotecaria",
  },
  ...[1, 2, 3].map((number) => ({
    email: `aluno${number}.teste@ominisaber.com.br`,
    password: "senha123aluno",
    registration: number === 1 ? "useraluno" : `useraluno${number}`,
    name: ["Ana Clara Souza", "Bruno Mendes Lima", "Carla Oliveira Santos"][
      number - 1
    ],
    role: "aluno",
    course: "informatica",
  })),
];

const classId = "d2400000-0000-4000-8000-000000000001";
const labIds = [
  "d2500000-0000-4000-8000-000000000011",
  "d2500000-0000-4000-8000-000000000012",
];
const eventId = "d2500000-0000-4000-8000-000000000031";

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

const ensureUser = async (account) => {
  const metadata = {
    nome: account.name,
    matricula: account.registration,
    role: account.role,
    ...(account.teacherType ? { tipo_professor: account.teacherType } : {}),
    ...(account.course ? { curso_tecnico: account.course } : {}),
  };
  let user = await findUser(account.email);
  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: account.password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { ominisaber_role: account.role },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { ominisaber_role: account.role },
    });
    if (error) throw error;
    user = data.user;
  }

  const profile = await admin
    .from("perfis")
    .update({
      nome: account.name,
      matricula: account.registration,
      role: account.role,
      tipo_professor: account.teacherType || null,
      curso_tecnico: account.course || null,
      ativo: true,
      primeiro_acesso_pendente: false,
    })
    .eq("id", user.id)
    .select("id")
    .single();
  if (profile.error) throw profile.error;
  return user.id;
};

const ids = new Map();
for (const account of accounts)
  ids.set(account.registration, await ensureUser(account));

const classResult = await admin.from("turmas").upsert({
  id: classId,
  nome: "1º Ano A · Informática",
  ano_letivo: 2026,
  serie: "1",
});
if (classResult.error) throw classResult.error;

const studentRegistrations = ["useraluno", "useraluno2", "useraluno3"];
const studentIds = studentRegistrations.map((registration) =>
  ids.get(registration),
);
const studentsUpdate = await admin
  .from("perfis")
  .update({ turma_id: classId, curso_tecnico: "informatica" })
  .in("id", studentIds);
if (studentsUpdate.error) throw studentsUpdate.error;

const teacherSubjects = [
  ["userprofmatematica", "matematica"],
  ["userprofportugues", "portugues"],
  ["userprofadministracao", "tecnico_administracao"],
  ["userprofinformatica", "tecnico_informatica"],
];
for (const [registration, subject] of teacherSubjects) {
  const professorId = ids.get(registration);
  const legacy = await admin
    .from("professor_turmas")
    .upsert(
      { professor_id: professorId, turma_id: classId, materia: subject },
      { onConflict: "professor_id,turma_id" },
    );
  if (legacy.error) throw legacy.error;
  const canonical = await admin.from("professor_turma_materias").upsert(
    {
      professor_id: professorId,
      turma_id: classId,
      materia_codigo: subject,
      ativo: true,
      atribuido_por: ids.get("usergestor"),
    },
    { onConflict: "professor_id,turma_id,materia_codigo" },
  );
  if (canonical.error) throw canonical.error;
}

const mathAccount = accounts.find(
  (account) => account.registration === "userprofmatematica",
);
const mathTeacherId = ids.get(mathAccount.registration);
const mathTeacher = publicClient();
const teacherLogin = await mathTeacher.auth.signInWithPassword({
  email: mathAccount.email,
  password: mathAccount.password,
});
if (teacherLogin.error) throw teacherLogin.error;

const skillSearches = ["D043_M", "EM13MAT103", "D049_M", "D064_M"];
const skillIds = [];
for (const search of skillSearches) {
  if (search.startsWith("D")) {
    const descriptor = await admin
      .from("descritores_curriculares")
      .select("id")
      .eq("codigo", search)
      .eq("materia_codigo", "matematica")
      .limit(1)
      .maybeSingle();
    if (descriptor.error) throw descriptor.error;
    if (!descriptor.data)
      throw new Error(`Descritor de Matemática não encontrado: ${search}.`);
    const link = await admin
      .from("habilidade_descritores")
      .select("habilidade_id")
      .eq("descritor_id", descriptor.data.id)
      .limit(1)
      .maybeSingle();
    if (link.error) throw link.error;
    if (!link.data)
      throw new Error(`Descritor sem habilidade publicada: ${search}.`);
    skillIds.push(link.data.habilidade_id);
  } else {
    const skill = await admin
      .from("habilidades_curriculares")
      .select("id")
      .eq("codigo", search)
      .eq("materia_codigo", "matematica")
      .limit(1)
      .maybeSingle();
    if (skill.error) throw skill.error;
    if (!skill.data)
      throw new Error(`Habilidade de Matemática não encontrada: ${search}.`);
    skillIds.push(skill.data.id);
  }
}

let evaluationLookup = await mathTeacher
  .from("avaliacoes_docentes")
  .select("id")
  .eq("professor_id", mathTeacherId)
  .contains("configuracao", { seed_key: "demo-matematica-interativa-v1" })
  .maybeSingle();
if (evaluationLookup.error) throw evaluationLookup.error;
let evaluationId = evaluationLookup.data?.id;

if (!evaluationId) {
  const created = await mathTeacher.rpc("criar_atividade_docente", {
    p_payload: {
      title: "Circuito interativo de Matemática — PAEBES",
      instructions:
        "Resolva as quatro estações. Cada resposta é salva automaticamente e gera evidências por descritor.",
      duration: 40,
      value: 10,
      classId,
      subject: "matematica",
      category: "atividade",
      series: 1,
      trimester: 1,
      scoringMode: "manual",
      attempts: 3,
      shuffleQuestions: false,
      shuffleAlternatives: false,
      immediateFeedback: true,
      showAnswerKey: true,
      configuration: {
        seed_key: "demo-matematica-interativa-v1",
        experienceStyle: "oficina_interativa",
      },
      publish: true,
      questions: [
        {
          type: "resposta_curta",
          statement:
            "No plano cartesiano, marque o ponto P de coordenadas (2, 3).",
          answer: "2;3",
          explanation:
            "A abscissa 2 indica o deslocamento horizontal e a ordenada 3 indica o deslocamento vertical.",
          points: 2.5,
          skillIds: [skillIds[0]],
          required: true,
          configuration: {
            mathMode: "plano_cartesiano",
            minX: -5,
            maxX: 5,
            minY: -5,
            maxY: 5,
            targetX: 2,
            targetY: 3,
          },
        },
        {
          type: "numerica",
          statement:
            "Posicione na reta o número decimal correspondente a três inteiros e cinco décimos.",
          answer: "3.5",
          explanation: "Três inteiros e cinco décimos correspondem a 3,5.",
          points: 2.5,
          skillIds: [skillIds[1]],
          required: true,
          configuration: {
            mathMode: "reta_numerica",
            min: 0,
            max: 10,
            step: 0.5,
            target: 3.5,
          },
        },
        {
          type: "numerica",
          statement:
            "Um triângulo retângulo possui catetos de 3 m e 4 m. Determine a hipotenusa.",
          answer: "5",
          explanation:
            "Pelo teorema de Pitágoras: 3² + 4² = 25, portanto a hipotenusa mede 5 m.",
          points: 2.5,
          skillIds: [skillIds[2]],
          required: true,
          configuration: {
            mathMode: "pitagoras",
            sideA: 3,
            sideB: 4,
            sideC: 5,
            unit: "m",
            target: 5,
            solution: "3² + 4² = c²; 9 + 16 = 25; c = 5.",
          },
        },
        {
          type: "unica_escolha",
          statement:
            "Observe o gráfico de desempenho e selecione a turma que obteve a maior pontuação.",
          alternatives: ["Turma A", "Turma B", "Turma C", "Turma D"],
          answer: "Turma B",
          explanation:
            "A barra da Turma B representa 84 pontos, o maior valor do gráfico.",
          points: 2.5,
          skillIds: [skillIds[3]],
          required: true,
          configuration: {
            mathMode: "grafico_barras",
            chartRows: "Turma A | 68\nTurma B | 84\nTurma C | 76\nTurma D | 72",
            chartData: [
              { label: "Turma A", value: 68 },
              { label: "Turma B", value: 84 },
              { label: "Turma C", value: 76 },
              { label: "Turma D", value: 72 },
            ],
            correctLabel: "Turma B",
            axisLabel: "Pontuação",
          },
        },
      ],
    },
  });
  if (created.error) throw created.error;
  evaluationId = created.data;
}

const questions = await admin
  .from("questoes_avaliacao")
  .select("id,ordem")
  .eq("avaliacao_id", evaluationId)
  .order("ordem");
if (questions.error) throw questions.error;
if (questions.data.length !== 4)
  throw new Error("A atividade matemática precisa ter quatro questões.");

const studentAnswers = [
  ["2;3", "3.5", "5", "Turma B"],
  ["2;3", "4", "5", "Turma C"],
  ["2;3"],
];

for (const [studentIndex, registration] of studentRegistrations.entries()) {
  const account = accounts.find((item) => item.registration === registration);
  const student = publicClient();
  const login = await student.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (login.error) throw login.error;

  const existing = await student
    .from("tentativas_avaliacao")
    .select("id,status")
    .eq("avaliacao_id", evaluationId)
    .eq("aluno_id", ids.get(registration))
    .order("numero_tentativa", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (!existing.data) {
    const started = await student.rpc("iniciar_tentativa_avaliacao", {
      p_avaliacao_id: evaluationId,
    });
    if (started.error) throw started.error;
    for (const [answerIndex, answer] of studentAnswers[
      studentIndex
    ].entries()) {
      const saved = await student.rpc("salvar_resposta_avaliacao", {
        p_tentativa_id: started.data,
        p_questao_id: questions.data[answerIndex].id,
        p_resposta: answer,
      });
      if (saved.error) throw saved.error;
    }
    if (studentIndex < 2) {
      const submitted = await student.rpc("entregar_tentativa_avaliacao", {
        p_tentativa_id: started.data,
      });
      if (submitted.error) throw submitted.error;
    }
  }
  await student.auth.signOut();
}

const future = (days, hour) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
};

const labs = await admin.from("laboratorios_docentes").upsert([
  {
    id: labIds[0],
    professor_id: mathTeacherId,
    turma_id: classId,
    tipo_professor: "matematica",
    titulo: "Explorando coordenadas e distâncias",
    descricao:
      "Investigação visual com plano cartesiano, localização de pontos e distância entre coordenadas.",
    formato: "graficos",
    configuracao: { seed_key: "demo-matematica-lab-1" },
    status: "publicado",
    prazo: future(7, 18),
    publicado_em: new Date().toISOString(),
  },
  {
    id: labIds[1],
    professor_id: mathTeacherId,
    turma_id: classId,
    tipo_professor: "matematica",
    titulo: "Triângulos em movimento",
    descricao:
      "Simulação para comparar catetos, hipotenusa e aplicações do teorema de Pitágoras.",
    formato: "simulacao",
    configuracao: { seed_key: "demo-matematica-lab-2" },
    status: "rascunho",
    prazo: future(14, 18),
  },
]);
if (labs.error) throw labs.error;

const event = await admin.from("eventos_agenda").upsert({
  id: eventId,
  titulo: "Circuito de Matemática por descritores",
  descricao:
    "Atividade interativa com plano cartesiano, reta numérica, triângulos e gráficos.",
  tipo: "atividade",
  inicio: future(5, 8),
  fim: future(5, 9),
  materia: "Matemática",
  local: "Laboratório de Matemática",
  turma_id: classId,
  professor_id: mathTeacherId,
  status: "publicado",
});
if (event.error) throw event.error;

await mathTeacher.auth.signOut();

const loginChecks = [];
for (const account of accounts) {
  const client = publicClient();
  const result = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (result.error)
    throw new Error(
      `Falha no login de ${account.registration}: ${result.error.message}`,
    );
  loginChecks.push(account.registration);
  await client.auth.signOut();
}

const attempts = await admin
  .from("tentativas_avaliacao")
  .select("aluno_id,status,nota")
  .eq("avaliacao_id", evaluationId)
  .order("updated_at");
if (attempts.error) throw attempts.error;

console.log(
  JSON.stringify(
    {
      projeto: configuredProject,
      contasVerificadas: loginChecks,
      turma: "1º Ano A · Informática",
      avaliacaoMatematica: evaluationId,
      questoesInterativas: questions.data.length,
      laboratoriosMatematica: labIds.length,
      tentativas: attempts.data.map((attempt) => ({
        aluno: [...ids.entries()].find(
          ([, id]) => id === attempt.aluno_id,
        )?.[0],
        status: attempt.status,
        nota: attempt.nota,
      })),
    },
    null,
    2,
  ),
);
