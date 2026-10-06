import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.112.3/cors";
import {
  PORTUGUESE_PROMPT_CASES,
  selectPortuguesePromptCases,
} from "./portuguese-prompt-library.ts";

type JsonObject = Record<string, unknown>;

const subjects = [
  "matematica",
  "fisica",
  "quimica",
  "biologia",
  "portugues",
  "tecnico_administracao",
  "tecnico_informatica",
];
const actions = ["gerar_atividade", "gerar_trilha", "revisar_atividade", "sugerir_recuperacao"];
const questionTypes = [
  "unica_escolha",
  "verdadeiro_falso",
  "resposta_curta",
  "dissertativa",
  "numerica",
  "calculo",
  "codigo",
  "estudo_caso",
];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const env = (name: string) => Deno.env.get(name)?.trim() || "";
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, Math.round(number)))
    : fallback;
};
const text = (value: unknown, max = 2000) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const cleanTeacherText = (value: unknown, max = 2000) =>
  text(value, max)
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[e-mail removido]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento removido]")
    .replace(
      /\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}\b/g,
      "[telefone removido]",
    );

const cleanCurrentActivity = (value: unknown) => {
  const activity = (
    value && typeof value === "object" ? value : {}
  ) as JsonObject;
  return {
    title: cleanTeacherText(activity.title, 140),
    instructions: cleanTeacherText(activity.instructions, 6000),
    questions: (Array.isArray(activity.questions)
      ? (activity.questions as JsonObject[])
      : []
    )
      .slice(0, 100)
      .map((question) => ({
        type: text(question.type, 40),
        statement: cleanTeacherText(question.statement, 4000),
        alternatives: (Array.isArray(question.alternatives)
          ? question.alternatives
          : []
        )
          .slice(0, 12)
          .map((item) => cleanTeacherText(item, 500)),
        answer: cleanTeacherText(question.answer, 4000),
        explanation: cleanTeacherText(question.explanation, 4000),
        points: Number(question.points) || 0,
        skillIds: (Array.isArray(question.skillIds) ? question.skillIds : [])
          .map(String)
          .filter((id) => uuidPattern.test(id)),
      })),
  };
};

const cleanAggregateResults = (value: unknown, depth = 0): unknown => {
  if (depth > 4 || value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return cleanTeacherText(value, 500);
  if (Array.isArray(value))
    return value
      .slice(0, 100)
      .map((item) => cleanAggregateResults(item, depth + 1));
  if (typeof value !== "object") return null;
  return Object.fromEntries(
    Object.entries(value as JsonObject)
      .filter(
        ([key]) =>
          !/(?:aluno|student|usuario|user|nome|name|email|matricula|telefone|cpf)/i.test(
            key,
          ),
      )
      .slice(0, 60)
      .map(([key, item]) => [key, cleanAggregateResults(item, depth + 1)]),
  );
};

const allowedOrigins = () =>
  Array.from(
    new Set(
      [
        env("ALLOWED_ORIGINS"),
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "https://curious-pithivier-083ae7.netlify.app",
        "https://*.netlify.app",
      ]
        .join(",")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
const originAllowed = (origin: string) =>
  !origin ||
  allowedOrigins().some((allowed) => {
    if (allowed === origin) return true;
    if (!allowed.includes("*")) return false;
    const expression = allowed
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace("*", ".*");
    return new RegExp(`^${expression}$`, "i").test(origin);
  });
const corsHeaders = (origin: string) => ({
  ...supabaseCorsHeaders,
  "Access-Control-Allow-Origin":
    origin && originAllowed(origin) ? origin : allowedOrigins()[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
const reply = (
  origin: string,
  body: JsonObject,
  status = 200,
  requestId?: string,
) =>
  new Response(JSON.stringify({ ...body, requestId }), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });

const responseText = (payload: JsonObject) => {
  if (typeof payload.output_text === "string") return payload.output_text;
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  for (const step of steps as JsonObject[]) {
    if (step.type !== "model_output") continue;
    const content = Array.isArray(step.content) ? step.content : [];
    for (const block of content as JsonObject[]) {
      if (block.type === "text" && typeof block.text === "string")
        return block.text;
    }
  }
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output as JsonObject[]) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const block of content as JsonObject[]) {
      if (block.type === "output_text" && typeof block.text === "string")
        return block.text;
    }
  }
  return "";
};

const normalizeSuggestion = (
  value: JsonObject,
  allowedSkillIds: Set<string>,
  fallback: { category: string; duration: number; totalValue: number },
) => {
  const activity = (value.atividade || {}) as JsonObject;
  const rawQuestions = Array.isArray(activity.questoes)
    ? (activity.questoes as JsonObject[])
    : [];
  const questions = rawQuestions.slice(0, 12).map((question) => {
    const type = questionTypes.includes(String(question.tipo))
      ? String(question.tipo)
      : "unica_escolha";
    const alternatives = Array.isArray(question.alternativas)
      ? question.alternativas.map((item) => text(item, 500)).filter(Boolean)
      : [];
    return {
      type,
      statement: text(question.enunciado, 4000),
      alternatives,
      answer: text(question.resposta, 4000),
      explanation: text(question.explicacao, 4000),
      points: Math.max(0.01, Number(question.pontos) || 1),
      skillIds: Array.isArray(question.habilidade_ids)
        ? [...new Set(question.habilidade_ids.map(String))].filter((id) =>
            allowedSkillIds.has(id),
          )
        : [],
      required: question.obrigatoria !== false,
    };
  });
  if (!questions.length || questions.some((item) => item.statement.length < 3))
    throw new Error("A sugestão recebida não contém questões válidas.");
  return {
    summary: text(value.resumo, 1200),
    warnings: Array.isArray(value.avisos)
      ? value.avisos
          .map((item) => text(item, 500))
          .filter(Boolean)
          .slice(0, 8)
      : [],
    activity: {
      title: text(activity.titulo, 140),
      instructions: text(activity.orientacoes, 6000),
      category: text(activity.categoria, 30) || fallback.category,
      duration: clamp(activity.duracao_minutos, 5, 300, fallback.duration),
      value: Math.max(0.1, Number(activity.valor_total) || fallback.totalValue),
      scoringMode: activity.modo_pontuacao === "manual" ? "manual" : "igual",
      questions,
    },
    trail: value.trilha && typeof value.trilha === "object"
      ? {
          title: text((value.trilha as JsonObject).titulo, 160),
          description: text((value.trilha as JsonObject).descricao, 2000),
          steps: Array.isArray((value.trilha as JsonObject).etapas)
            ? ((value.trilha as JsonObject).etapas as JsonObject[]).slice(0, 12).map((step, index) => ({
                order: index + 1,
                title: text(step.titulo, 160),
                objective: text(step.objetivo, 600),
                interaction: text(step.interacao_tipo, 40) || "lista",
              }))
            : [],
        }
      : null,
  };
};

const buildTeacherContext = async (
  admin: ReturnType<typeof createClient>,
  professorId: string,
  classId: string,
  subject: string,
  specialty: string | null,
  includeAnalytics: boolean,
) => {
  const classResult = await admin
    .from("turmas")
    .select("id,nome,serie,ano_letivo")
    .eq("id", classId)
    .single();
  if (classResult.error) throw classResult.error;

  const baseContext = {
    source: "supabase",
    version: 1,
    professor: { specialty: specialty || subject },
    class: {
      name: classResult.data.nome,
      series: classResult.data.serie,
      schoolYear: classResult.data.ano_letivo,
    },
  };

  if (!includeAnalytics) {
    return {
      context: {
        ...baseContext,
        analysisAuthorized: false,
        recentActivities: [],
        recentTrails: [],
        aggregatePerformance: null,
      },
      summary: {
        source: "supabase",
        classLabel: classResult.data.nome,
        recentActivityCount: 0,
        recentTrailCount: 0,
        aggregateAttemptCount: 0,
        includesStudentPersonalData: false,
        analysisAuthorized: false,
      },
    };
  }

  const [activitiesResult, trailsResult] = await Promise.all([
    admin
      .from("avaliacoes_docentes")
      .select(
        "id,titulo,categoria,status,duracao_minutos,valor,serie,trimestre,created_at,questoes_avaliacao(tipo,pontos)",
      )
      .eq("professor_id", professorId)
      .eq("turma_id", classId)
      .eq("materia_codigo", subject)
      .order("created_at", { ascending: false })
      .limit(6),
    admin
      .from("trilhas")
      .select("id,titulo,tipo,publicada,interacao_tipo,created_at")
      .eq("professor_id", professorId)
      .eq("turma_id", classId)
      .eq("materia_codigo", subject)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (activitiesResult.error) throw activitiesResult.error;
  if (trailsResult.error) throw trailsResult.error;

  const activities = activitiesResult.data || [];
  const activityIds = activities.map((activity) => activity.id);
  let attempts: JsonObject[] = [];
  if (activityIds.length) {
    // Deliberadamente não seleciona aluno_id, respostas, feedback ou qualquer
    // identificador discente. O modelo recebe somente sinais agregados da turma.
    const attemptsResult = await admin
      .from("tentativas_avaliacao")
      .select("avaliacao_id,status,nota,requer_revisao")
      .in("avaliacao_id", activityIds)
      .in("status", ["enviada", "corrigida"]);
    if (attemptsResult.error) throw attemptsResult.error;
    attempts = (attemptsResult.data || []) as JsonObject[];
  }

  const valuesByActivity = new Map(
    activities.map((activity) => [activity.id, Number(activity.valor) || 0]),
  );
  const validPercentages = attempts
    .map((attempt) => {
      const value = valuesByActivity.get(String(attempt.avaliacao_id)) || 0;
      const grade = Number(attempt.nota);
      return value > 0 && Number.isFinite(grade)
        ? Math.max(0, Math.min(100, (grade / value) * 100))
        : null;
    })
    .filter((value): value is number => value !== null);
  const correctedAttempts = attempts.filter(
    (attempt) => attempt.status === "corrigida",
  ).length;
  const reviewPending = attempts.filter(
    (attempt) => attempt.requer_revisao === true,
  ).length;

  const context = {
    ...baseContext,
    analysisAuthorized: true,
    recentActivities: activities.map((activity) => {
      const questions = Array.isArray(activity.questoes_avaliacao)
        ? activity.questoes_avaliacao
        : [];
      const typeCounts = questions.reduce<Record<string, number>>(
        (counts, question) => {
          const type = text((question as JsonObject).tipo, 40);
          if (type) counts[type] = (counts[type] || 0) + 1;
          return counts;
        },
        {},
      );
      return {
        title: text(activity.titulo, 140),
        category: activity.categoria,
        status: activity.status,
        durationMinutes: activity.duracao_minutos,
        totalValue: Number(activity.valor) || 0,
        series: activity.serie,
        trimester: activity.trimestre,
        questionCount: questions.length,
        questionTypes: typeCounts,
      };
    }),
    recentTrails: (trailsResult.data || []).map((trail) => ({
      title: text(trail.titulo, 140),
      type: trail.tipo,
      published: trail.publicada === true,
      interactionType: trail.interacao_tipo,
    })),
    aggregatePerformance: {
      submittedAttempts: attempts.length,
      correctedAttempts,
      reviewPending,
      averagePercent:
        validPercentages.length > 0
          ? Math.round(
              validPercentages.reduce((sum, value) => sum + value, 0) /
                validPercentages.length,
            )
          : null,
    },
  };
  const summary = {
    source: "supabase",
    classLabel: classResult.data.nome,
    recentActivityCount: context.recentActivities.length,
    recentTrailCount: context.recentTrails.length,
    aggregateAttemptCount: attempts.length,
    includesStudentPersonalData: false,
    analysisAuthorized: true,
  };
  return { context, summary };
};

Deno.serve(async (request) => {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const origin = request.headers.get("Origin") || "";
  if (!originAllowed(origin))
    return reply(origin, { error: "Origem não autorizada." }, 403, requestId);
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders(origin) });
  if (request.method !== "POST")
    return reply(origin, { error: "Método não permitido." }, 405, requestId);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token)
    return reply(origin, { error: "Sessão ausente." }, 401, requestId);

  const supabaseUrl = env("SUPABASE_URL");
  const publicKey = env("SUPABASE_ANON_KEY");
  const serviceKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = env("GEMINI_API_KEY");
  if (!supabaseUrl || !publicKey || !serviceKey || !geminiKey)
    return reply(
      origin,
      { error: "O Copiloto ainda não foi configurado neste ambiente." },
      503,
      requestId,
    );

  const scoped = createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let executionId = "";

  try {
    const { data: auth, error: authError } = await scoped.auth.getUser(token);
    if (authError || !auth.user) throw new Error("Sessão inválida.");

    const { data: profile, error: profileError } = await admin
      .from("perfis")
      .select("id,role,tipo_professor,ativo")
      .eq("id", auth.user.id)
      .single();
    if (profileError) throw profileError;
    if (profile.role !== "professor" || profile.ativo === false)
      return reply(
        origin,
        { error: "Acesso exclusivo de professores ativos." },
        403,
        requestId,
      );

    const [{ data: flag, error: flagError }, { data: assignment }] =
      await Promise.all([
        admin
          .from("feature_flags")
          .select("habilitada_global,configuracao")
          .eq("chave", "professor_copiloto")
          .single(),
        admin
          .from("feature_flag_usuarios")
          .select("habilitada")
          .eq("feature_chave", "professor_copiloto")
          .eq("usuario_id", auth.user.id)
          .maybeSingle(),
      ]);
    if (flagError) throw flagError;
    const enabled = assignment
      ? assignment.habilitada === true
      : flag.habilitada_global === true;
    if (!enabled)
      return reply(
        origin,
        { error: "O Copiloto não está habilitado para esta conta." },
        403,
        requestId,
      );

    const body = (await request.json()) as JsonObject;
    const action = text(body.action, 40) || "gerar_atividade";
    const subject = text(body.subject, 40);
    const classId = text(body.classId, 40);
    const useClassContext = body.useClassContext === true;
    const skillIds = [
      ...new Set(
        (Array.isArray(body.skillIds) ? body.skillIds : [])
          .map(String)
          .filter((id) => uuidPattern.test(id)),
      ),
    ].slice(0, 20);
    const skillCandidateIds = [
      ...new Set(
        (Array.isArray(body.skillCandidateIds) ? body.skillCandidateIds : [])
          .map(String)
          .filter((id) => uuidPattern.test(id)),
      ),
    ].slice(0, 80);
    if (!actions.includes(action))
      throw new Error("Ação do Copiloto inválida.");
    if (!subjects.includes(subject)) throw new Error("Matéria inválida.");
    if (!uuidPattern.test(classId)) throw new Error("Turma inválida.");
    if (action === "sugerir_recuperacao" && !body.aggregateResults)
      throw new Error("A recuperação exige resultados agregados da turma.");

    const { data: link, error: linkError } = await admin
      .from("professor_turma_materias")
      .select("turma_id,materia_codigo")
      .eq("professor_id", auth.user.id)
      .eq("turma_id", classId)
      .eq("materia_codigo", subject)
      .eq("ativo", true)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link)
      return reply(
        origin,
        { error: "Você não possui vínculo com esta turma e matéria." },
        403,
        requestId,
      );

    let skills: JsonObject[] = [];
    const curriculumIds = skillIds.length ? skillIds : skillCandidateIds;
    if (curriculumIds.length) {
      const { data, error: skillsError } = await admin
        .from("habilidades_curriculares")
        .select("id,codigo,descricao,materia_codigo")
        .in("id", curriculumIds)
        .eq("materia_codigo", subject);
      if (skillsError) throw skillsError;
      skills = (data || []) as JsonObject[];
      if (skills.length !== curriculumIds.length)
        throw new Error("Uma ou mais habilidades não pertencem à matéria.");
    }

    const teacherContext = await buildTeacherContext(
      admin,
      auth.user.id,
      classId,
      subject,
      profile.tipo_professor,
      useClassContext,
    );

    const configuration = (flag.configuracao || {}) as JsonObject;
    const minuteLimit = clamp(configuration.limite_por_minuto, 1, 20, 3);
    const dailyLimit = clamp(configuration.limite_diario, 1, 500, 40);
    const now = Date.now();
    const [minuteUsage, dailyUsage] = await Promise.all([
      admin
        .from("copiloto_execucoes")
        .select("id", { count: "exact", head: true })
        .eq("professor_id", auth.user.id)
        .in("status", ["processando", "concluida"])
        .gte("created_at", new Date(now - 60_000).toISOString()),
      admin
        .from("copiloto_execucoes")
        .select("id", { count: "exact", head: true })
        .eq("professor_id", auth.user.id)
        .in("status", ["processando", "concluida"])
        .gte("created_at", new Date(now - 86_400_000).toISOString()),
    ]);
    if (minuteUsage.error) throw minuteUsage.error;
    if (dailyUsage.error) throw dailyUsage.error;
    if ((minuteUsage.count || 0) >= minuteLimit)
      return reply(
        origin,
        { error: "Aguarde um minuto antes de pedir outra sugestão." },
        429,
        requestId,
      );
    if ((dailyUsage.count || 0) >= dailyLimit)
      return reply(
        origin,
        { error: "O limite diário do Copiloto foi atingido." },
        429,
        requestId,
      );

    const objective = cleanTeacherText(body.objective, 2000);
    if (objective.length < 10)
      throw new Error(
        "Descreva o objetivo pedagógico com ao menos 10 caracteres.",
      );
    const quantity = clamp(
      body.questionCount,
      1,
      clamp(configuration.max_questoes, 1, 20, 12),
      5,
    );
    const requestedTypes = [
      ...new Set(
        (Array.isArray(body.questionTypes) ? body.questionTypes : [])
          .map(String)
          .filter((item) => questionTypes.includes(item)),
      ),
    ];
    const allFormatsEnabled =
      body.allFormatsEnabled === true && requestedTypes.length === questionTypes.length;
    const allowedQuestionTypes = requestedTypes.length ? requestedTypes : questionTypes;
    const difficulty = ["equilibrada", "introducao", "aprofundamento"].includes(
      String(body.difficulty),
    )
      ? String(body.difficulty)
      : "equilibrada";
    const category = [
      "atividade",
      "avaliacao",
      "diagnostica",
      "recuperacao",
    ].includes(String(body.category))
      ? String(body.category)
      : "atividade";
    const duration = clamp(body.duration, 5, 300, 50);
    const totalValue = Math.max(0.1, Math.min(1000, Number(body.value) || 10));
    const requestSummary = {
      action,
      subject,
      series: clamp(body.series, 1, 3, 1),
      trimester: body.trimester ? clamp(body.trimester, 1, 3, 1) : null,
      category,
      duration,
      totalValue,
      questionCount: quantity,
      questionTypes: requestedTypes,
      allFormatsEnabled,
      difficulty,
      objective,
      useClassContext,
    };

    let sessionId = text(body.sessionId, 40);
    if (sessionId && uuidPattern.test(sessionId)) {
      const { data: session } = await admin
        .from("copiloto_sessoes")
        .select("id")
        .eq("id", sessionId)
        .eq("professor_id", auth.user.id)
        .maybeSingle();
      if (!session) sessionId = "";
    } else sessionId = "";
    if (!sessionId) {
      const { data: session, error: sessionError } = await admin
        .from("copiloto_sessoes")
        .insert({
          professor_id: auth.user.id,
          turma_id: classId,
          materia_codigo: subject,
          titulo: objective.slice(0, 140) || "Planejamento de atividade",
          contexto: {
            series: requestSummary.series,
            trimester: requestSummary.trimester,
            category,
            supabase: teacherContext.summary,
          },
        })
        .select("id")
        .single();
      if (sessionError) throw sessionError;
      sessionId = session.id;
    }

    const { data: execution, error: executionError } = await admin
      .from("copiloto_execucoes")
      .insert({
        sessao_id: sessionId,
        professor_id: auth.user.id,
        turma_id: classId,
        acao: action,
        materia_codigo: subject,
        habilidade_ids: skillIds,
        solicitacao_resumo: requestSummary,
        provedor: "google-gemini",
        modelo: env("GEMINI_MODEL") || "gemini-3.5-flash-lite",
      })
      .select("id")
      .single();
    if (executionError) throw executionError;
    executionId = execution.id;

    const allowedIds = new Set(skills.map((skill) => String(skill.id)));
    const outputSchema = {
      type: "object",
      additionalProperties: false,
      required: ["resumo", "avisos", "atividade"],
      properties: {
        resumo: { type: "string" },
        avisos: { type: "array", items: { type: "string" }, maxItems: 8 },
        atividade: {
          type: "object",
          additionalProperties: false,
          required: [
            "titulo",
            "orientacoes",
            "categoria",
            "duracao_minutos",
            "valor_total",
            "modo_pontuacao",
            "questoes",
          ],
          properties: {
            titulo: { type: "string" },
            orientacoes: { type: "string" },
            categoria: {
              type: "string",
              enum: ["atividade", "avaliacao", "diagnostica", "recuperacao"],
            },
            duracao_minutos: { type: "integer", minimum: 5, maximum: 300 },
            valor_total: { type: "number", minimum: 0.1, maximum: 1000 },
            modo_pontuacao: { type: "string", enum: ["igual", "manual"] },
            questoes: {
              type: "array",
              minItems: 1,
              maxItems: quantity,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "tipo",
                  "enunciado",
                  "alternativas",
                  "resposta",
                  "explicacao",
                  "pontos",
                  "habilidade_ids",
                  "obrigatoria",
                ],
                properties: {
                  tipo: { type: "string", enum: allowedQuestionTypes },
                  enunciado: { type: "string" },
                  alternativas: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 8,
                  },
                  resposta: { type: "string" },
                  explicacao: { type: "string" },
                  pontos: { type: "number", minimum: 0.01 },
                  habilidade_ids: {
                    type: "array",
                    ...(skills.length ? { minItems: 1 } : { maxItems: 0 }),
                    items: skills.length
                      ? { type: "string", enum: [...allowedIds] }
                      : { type: "string" },
                  },
                  obrigatoria: { type: "boolean" },
                },
              },
            },
          },
        },
        trilha: {
          type: "object",
          additionalProperties: false,
          required: ["titulo", "descricao", "etapas"],
          properties: {
            titulo: { type: "string" },
            descricao: { type: "string" },
            etapas: { type: "array", minItems: 2, maxItems: 12, items: {
              type: "object", additionalProperties: false,
              required: ["titulo", "objetivo", "interacao_tipo"],
              properties: { titulo: { type: "string" }, objetivo: { type: "string" }, interacao_tipo: { type: "string" } },
            } },
          },
        },
      },
    };
    const input = {
      tarefa: action,
      contexto: requestSummary,
      habilidades: skills.map((skill) => ({
        id: skill.id,
        codigo: skill.codigo,
        descricao: skill.descricao,
      })),
      atividade_atual:
        action === "revisar_atividade" && body.currentActivity
          ? cleanCurrentActivity(body.currentActivity)
          : null,
      resultados_agregados:
        action === "sugerir_recuperacao"
          ? cleanAggregateResults(body.aggregateResults)
          : null,
      contexto_docente_supabase: teacherContext.context,
    };
    const portuguesePromptCases =
      subject === "portugues"
        ? selectPortuguesePromptCases({
            objective,
            skills,
            questionTypes: requestedTypes,
            category,
            difficulty,
            allFormatsEnabled,
          })
        : [];
    const planningInstruction = allFormatsEnabled
      ? "Antes de gerar o JSON final, faça uma etapa interna adicional de planejamento: compare todos os formatos permitidos, escolha conscientemente os mais adequados a cada habilidade, varie as interações sem artificialidade e revise clareza, progressão, gabarito e distribuição de pontos. Não revele raciocínio interno; retorne somente o JSON solicitado."
      : "Antes de retornar, confira internamente alinhamento curricular, clareza, gabarito e distribuição de pontos. Não revele raciocínio interno; retorne somente o JSON solicitado.";
    const portugueseCaseInstruction = portuguesePromptCases.length
      ? `\n\nCasos pedagógicos de Língua Portuguesa selecionados da biblioteca (${PORTUGUESE_PROMPT_CASES.length} disponíveis):\n${portuguesePromptCases
          .map((item, index) => `${index + 1}. ${item.title}: ${item.prompt}`)
          .join("\n")}`
      : "";
    const curriculumInstruction = skills.length
      ? `${skillIds.length ? "Alinhe o conteúdo exclusivamente às habilidades selecionadas" : "Escolha automaticamente uma ou mais habilidades curriculares compatíveis com o pedido"} e use apenas os respectivos identificadores em habilidade_ids. Toda questão deve ter ao menos uma habilidade_ids.`
      : "Nenhuma habilidade curricular foi selecionada. Estruture a proposta a partir do pedido, da série, da matéria e do contexto autorizado da turma; não invente códigos curriculares e retorne habilidade_ids como uma lista vazia em todas as questões.";
    const trailInstruction = action === "gerar_trilha"
      ? "A ação é gerar_trilha: além de uma atividade inicial curta, preencha trilha com título, descrição e 2 a 12 etapas progressivas; cada etapa deve ter objetivo e interacao_tipo compatível (lista, leitura, escrita, flashcards, calculadora, formulas, simulacao, tabela_periodica, diagrama, timeline, mapa_mental ou dialogo)."
      : "";
    const systemInstruction =
      `Você é o Copiloto Docente do OminiSaber. Produza apenas conteúdo pedagógico em português brasileiro. ${curriculumInstruction} ${trailInstruction} Use desempenho, atividades e trilhas do contexto docente do Supabase somente quando analysisAuthorized for true; quando for false, use apenas turma, componente, pedido e eventuais habilidades explicitamente selecionadas. Nunca copie mecanicamente atividades anteriores. Os indicadores de desempenho, quando autorizados, são agregados: nunca tente identificar, inferir ou mencionar alunos. Não inclua nomes ou dados pessoais. Toda saída será um rascunho revisado pelo professor; nunca afirme que publicou, corrigiu ou atribuiu nota. Para questões objetivas, forneça alternativas plausíveis, uma resposta exatamente igual à alternativa correta e uma explicação pedagógica. Evite pegadinhas, estereótipos, conteúdo discriminatório e ambiguidade. ${planningInstruction}${portugueseCaseInstruction}`;
    const aiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": geminiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env("GEMINI_MODEL") || "gemini-3.5-flash-lite",
          input: `${systemInstruction}\n\nDados pedagógicos validados pelo servidor:\n${JSON.stringify(input)}`,
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: outputSchema,
          },
        }),
      },
    );
    const aiPayload = (await aiResponse.json()) as JsonObject;
    if (!aiResponse.ok)
      throw new Error(
        text((aiPayload.error as JsonObject)?.message, 500) ||
          "O provedor de IA não concluiu a solicitação.",
      );
    const rawOutput = responseText(aiPayload);
    if (!rawOutput)
      throw new Error("O provedor não retornou conteúdo utilizável.");
    const suggestion = normalizeSuggestion(
      JSON.parse(rawOutput) as JsonObject,
      allowedIds,
      { category, duration, totalValue },
    );
    const usage = (aiPayload.usage ||
      aiPayload.usage_metadata || {}) as JsonObject;
    const latency = Math.round(performance.now() - startedAt);
    const { error: finishError } = await admin
      .from("copiloto_execucoes")
      .update({
        status: "concluida",
        resultado: suggestion,
        tokens_entrada:
          Number(
            usage.total_input_tokens ||
              usage.input_tokens ||
              usage.prompt_token_count,
          ) || null,
        tokens_saida:
          Number(
            usage.total_output_tokens ||
              usage.output_tokens ||
              usage.candidates_token_count,
          ) || null,
        latencia_ms: latency,
        concluida_em: new Date().toISOString(),
      })
      .eq("id", executionId);
    if (finishError) throw finishError;
    return reply(
      origin,
      {
        executionId,
        sessionId,
        suggestion,
        contextSummary: teacherContext.summary,
      },
      200,
      requestId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    if (executionId) {
      await admin
        .from("copiloto_execucoes")
        .update({
          status: "falhou",
          codigo_erro: message.slice(0, 120),
          latencia_ms: Math.round(performance.now() - startedAt),
          concluida_em: new Date().toISOString(),
        })
        .eq("id", executionId);
    }
    const status = /Sessão/.test(message) ? 401 : 400;
    return reply(origin, { error: message }, status, requestId);
  }
});
