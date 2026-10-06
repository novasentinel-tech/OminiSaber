import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const migration = read("backend/migrations/20260926120000_oministudio_persistencia_rls.sql");
const api = read("engine/src/core/studio-api.js");
const app = read("engine/src/App.jsx");
const html = read("engine/index.html");
const packageJson = JSON.parse(read("backend/package.json"));
const rlsTest = read("backend/supabase/tests/oministudio_rls.test.sql");

const checks = [
  ["seis tabelas do OminiStudio", ["studio_experiencias", "studio_experiencia_versoes", "studio_experiencia_turmas", "studio_tentativas", "studio_respostas", "studio_auditoria"].every((name) => migration.includes(`public.${name}`))],
  ["RLS habilitado em todas as tabelas", (migration.match(/alter table public\.studio_[a-z_]+ enable row level security;/g) || []).length === 6],
  ["grants anon revogados", migration.includes("from anon, authenticated")],
  ["políticas possuem papéis explícitos", ["studio_experiencias_select", "studio_experiencias_insert", "studio_experiencias_update", "studio_experiencias_delete", "studio_versoes_select", "studio_turmas_select", "studio_tentativas_select", "studio_respostas_select", "studio_respostas_update", "studio_auditoria_select"].every((name) => new RegExp(`create policy ${name}[\\s\\S]{0,100}for (select|insert|update|delete) to authenticated`).test(migration))],
  ["UPDATE possui USING e WITH CHECK", /create policy studio_experiencias_update[\s\S]+?using \([\s\S]+?with check \(/.test(migration)],
  ["versões publicadas imutáveis", migration.includes("studio_versoes_imutaveis") && migration.includes("Versoes publicadas do OminiStudio sao imutaveis")],
  ["gabarito removido do snapshot do aluno", migration.includes("value - 'correct' - 'min' - 'max' - 'rubric'")],
  ["funções privilegiadas ficam no schema private", ["private.publicar_experiencia_studio", "private.obter_experiencia_publicada_studio", "private.iniciar_tentativa_studio", "private.salvar_resposta_studio", "private.enviar_tentativa_studio", "private.corrigir_resposta_studio"].every((name) => migration.includes(name))],
  ["wrappers públicos usam SECURITY INVOKER", (migration.match(/security invoker/g) || []).length >= 8],
  ["funções RPC negadas para anon", (migration.match(/revoke all on function public\.[a-z_]+\([^;]+ from public, anon;/g) || []).length >= 6],
  ["cliente valida usuário com getUser", api.includes("db.auth.getUser()")],
  ["cliente valida especialidade autenticada", api.includes("profile.tipo_professor !== teacherType")],
  ["rascunho sincronizado no Supabase", api.includes('.from("studio_experiencias")') && app.includes("saveStudioDraft")],
  ["publicação por turma conectada", api.includes('rpc("publicar_experiencia_studio"') && app.includes("Publicar para turmas")],
  ["APIs de tentativa, resposta e correção disponíveis", ["startStudioAttempt", "saveStudioAnswer", "submitStudioAttempt", "gradeStudioAnswer"].every((name) => api.includes(`function ${name}`))],
  ["supabase-js fixado", packageJson.dependencies["@supabase/supabase-js"] === "2.112.3" && html.includes("/backend/vendor/supabase-2.112.3.js")],
  ["teste RLS cobre negações", rlsTest.includes("outro professor nao le") && rlsTest.includes("aluno de outra turma") && rlsTest.includes("anon nao acessa")],
  ["teste RLS cobre fluxo completo", ["publicar_experiencia_studio", "iniciar_tentativa_studio", "salvar_resposta_studio", "enviar_tentativa_studio"].every((name) => rlsTest.includes(name))],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "FALHA"} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exitCode = 1;
else console.log(`OminiStudio Supabase: ${checks.length}/${checks.length} verificações aprovadas.`);
