import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "../../backend/node_modules/@supabase/supabase-js/dist/index.mjs";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "../..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(projectRoot, ".env"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
);

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Configuração Supabase indisponível.");

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const prefix = "[AUDITORIA E2E]";

async function inventory() {
  const [{ data: profiles, error: profilesError }, { data: activities, error: activitiesError }] =
    await Promise.all([
      db.from("perfis").select("id,nome,matricula,role,turma_id,tipo_professor").order("role").order("nome"),
      db.from("avaliacoes_docentes").select("id,titulo,status,turma_id,professor_id,created_at").ilike("titulo", `${prefix}%`).order("created_at"),
    ]);
  if (profilesError) throw profilesError;
  if (activitiesError) throw activitiesError;
  const { data: authData, error: authError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (authError) throw authError;
  const emailById = new Map((authData.users || []).map((user) => [user.id, user.email]));
  console.log(
    JSON.stringify(
      {
        profiles: profiles.map((profile) => ({ ...profile, email: emailById.get(profile.id) || null })),
        taggedActivities: activities,
      },
      null,
      2,
    ),
  );
}

async function cleanup() {
  const { data: activities, error } = await db
    .from("avaliacoes_docentes")
    .select("id,titulo")
    .ilike("titulo", `${prefix}%`);
  if (error) throw error;
  const ids = (activities || []).map((item) => item.id);
  if (!ids.length) {
    console.log(JSON.stringify({ removed: 0, ids: [] }));
    return;
  }

  // A exclusão direta da avaliação não é suficiente depois que há uma
  // entrega: respostas_avaliacao protege questoes_avaliacao com RESTRICT.
  // Remova primeiro as evidências dependentes, preservando a ordem das FKs.
  const { data: attempts, error: attemptsError } = await db
    .from("tentativas_avaliacao")
    .select("id")
    .in("avaliacao_id", ids);
  if (attemptsError) throw attemptsError;

  const attemptIds = (attempts || []).map((item) => item.id);
  if (attemptIds.length) {
    const { error: answersError } = await db
      .from("respostas_avaliacao")
      .delete()
      .in("tentativa_id", attemptIds);
    if (answersError) throw answersError;
  }

  // A auditoria usa SET NULL para conservar histórico por padrão. Como estes
  // registros são estritamente sintéticos, eles também devem sair da base.
  const { error: auditError } = await db
    .from("avaliacoes_auditoria")
    .delete()
    .in("avaliacao_id", ids);
  if (auditError) throw auditError;

  const { error: deleteError } = await db.from("avaliacoes_docentes").delete().in("id", ids);
  if (deleteError) throw deleteError;
  console.log(
    JSON.stringify({
      removed: ids.length,
      removedAnswersFromAttempts: attemptIds.length,
      ids,
    }),
  );
}

async function verify() {
  const [activityResult, notificationResult] = await Promise.all([
    db
      .from("avaliacoes_docentes")
      .select("id,titulo,status,turma_id,professor_id,valor,created_at,updated_at")
      .ilike("titulo", `${prefix}%`)
      .order("created_at", { ascending: false }),
    db
      .from("notificacoes")
      .select("id,titulo,mensagem,avaliacao_id,created_at")
      .ilike("mensagem", `${prefix}%`)
      .order("created_at", { ascending: false }),
  ]);
  const { data: activities, error: activityError } = activityResult;
  const { data: notifications, error: notificationError } = notificationResult;
  if (activityError) throw activityError;
  if (notificationError) throw notificationError;
  const activityIds = (activities || []).map((item) => item.id);
  if (!activityIds.length) {
    console.log(
      JSON.stringify({ activities: [], attempts: [], answers: [], audit: [], notifications }, null, 2),
    );
    return;
  }
  const [{ data: attempts, error: attemptError }, { data: audit, error: auditError }] = await Promise.all([
    db
      .from("tentativas_avaliacao")
      .select("id,avaliacao_id,aluno_id,status,numero_tentativa,pontuacao_automatica,pontuacao_manual,nota,requer_revisao,iniciada_em,enviada_em,corrigida_em")
      .in("avaliacao_id", activityIds)
      .order("iniciada_em"),
    db
      .from("avaliacoes_auditoria")
      .select("avaliacao_id,tentativa_id,ator_id,evento,created_at")
      .in("avaliacao_id", activityIds)
      .order("created_at"),
  ]);
  if (attemptError) throw attemptError;
  if (auditError) throw auditError;
  const attemptIds = (attempts || []).map((item) => item.id);
  const { data: answers, error: answerError } = attemptIds.length
    ? await db
        .from("respostas_avaliacao")
        .select("id,tentativa_id,questao_id,resposta,status_correcao,correta,pontos_automaticos,pontos_manuais,respondida_em,corrigida_em")
        .in("tentativa_id", attemptIds)
        .order("respondida_em")
    : { data: [], error: null };
  if (answerError) throw answerError;
  console.log(JSON.stringify({ activities, attempts, answers, audit, notifications }, null, 2));
}

const command = process.argv[2] || "inventory";
if (command === "inventory") await inventory();
else if (command === "cleanup") await cleanup();
else if (command === "verify") await verify();
else throw new Error(`Comando desconhecido: ${command}`);
