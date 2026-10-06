import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  throw new Error("Configure SUPABASE_URL e a chave de serviço.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: evaluations, error: evaluationsError } = await supabase
  .from("avaliacoes_docentes")
  .select("id,professor_id,status,configuracao");

if (evaluationsError) throw evaluationsError;

const professorIds = [
  ...new Set((evaluations || []).map((item) => item.professor_id).filter(Boolean)),
];
const { data: profiles, error: profilesError } = professorIds.length
  ? await supabase.from("perfis").select("id,nome").in("id", professorIds)
  : { data: [], error: null };

if (profilesError) throw profilesError;

const names = new Map((profiles || []).map((profile) => [profile.id, profile.nome]));
let updated = 0;

for (const evaluation of evaluations || []) {
  // Publicações são registros pedagógicos imutáveis por regra do banco.
  // Elas continuam com o fallback seguro por disciplina no catálogo.
  if (evaluation.status !== "rascunho") continue;
  const name = String(names.get(evaluation.professor_id) || "").trim();
  if (!name) continue;
  const currentAuthor = evaluation.configuracao?.author;
  if (
    currentAuthor?.id === evaluation.professor_id &&
    String(currentAuthor?.name || "").trim() === name
  ) {
    continue;
  }
  const { error } = await supabase
    .from("avaliacoes_docentes")
    .update({
      configuracao: {
        ...(evaluation.configuracao || {}),
        author: { id: evaluation.professor_id, name },
      },
    })
    .eq("id", evaluation.id);
  if (error) throw error;
  updated += 1;
}

console.log(
  JSON.stringify({ scanned: evaluations?.length || 0, updated }),
);
