import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const publicKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !publicKey)
  throw new Error("Preencha SUPABASE_URL e a chave pública no .env.");

const client = createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const username =
  process.env.TEST_PORTUGUESE_TEACHER_USERNAME || "userprofportugues";
const password =
  process.env.TEST_PORTUGUESE_TEACHER_PASSWORD || "senha123profportugues";
const result = {
  login: false,
  perfil: false,
  turmas: false,
  redacoes: false,
  propostas: false,
  avaliacoes: false,
  rascunhosCorrecao: false,
  erro: null,
};

try {
  const resolved = await client.rpc("email_por_matricula", {
    matricula_input: username,
  });
  if (resolved.error) throw resolved.error;
  if (!resolved.data)
    throw new Error(
      `A conta de teste ${username} não existe ou não possui e-mail de acesso neste projeto.`,
    );
  const signedIn = await client.auth.signInWithPassword({
    email: resolved.data,
    password,
  });
  if (signedIn.error) throw signedIn.error;
  result.login = Boolean(signedIn.data.session);

  const profile = await client
    .from("perfis")
    .select("id,role,tipo_professor")
    .eq("id", signedIn.data.user.id)
    .single();
  if (profile.error) throw profile.error;
  result.perfil =
    profile.data.role === "professor" &&
    profile.data.tipo_professor === "portugues";

  const checks = await Promise.all([
    client
      .from("professor_turmas")
      .select("turma_id", { count: "exact", head: true })
      .eq("professor_id", signedIn.data.user.id),
    client
      .from("redacoes")
      .select("id", { count: "exact", head: true })
      .in("status", ["enviada", "corrigida"]),
    client
      .from("propostas_redacao")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", signedIn.data.user.id),
    client
      .from("avaliacoes_docentes")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", signedIn.data.user.id)
      .eq("tipo_professor", "portugues"),
    client
      .from("rascunhos_correcao_redacao")
      .select("redacao_id", { count: "exact", head: true })
      .eq("professor_id", signedIn.data.user.id),
  ]);
  [
    "turmas",
    "redacoes",
    "propostas",
    "avaliacoes",
    "rascunhosCorrecao",
  ].forEach((key, index) => {
    result[key] = !checks[index].error;
  });
  const firstError = checks.find((check) => check.error)?.error;
  if (firstError) throw firstError;
} catch (error) {
  result.erro = error.message;
  process.exitCode = 1;
} finally {
  if (result.login) await client.auth.signOut();
}

console.log(JSON.stringify(result, null, 2));
if (Object.entries(result).some(([key, value]) => key !== "erro" && !value))
  process.exitCode = 1;
