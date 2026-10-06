import dotenv from "dotenv";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secretKey)
  throw new Error(
    "Configuração administrativa do Supabase incompleta no .env.",
  );

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const checks = {
  host: new URL(url).host,
  perfis: false,
  turmaECurso: false,
  camposDoPortal: false,
  atualizacaoPerfilAtomica: false,
  tabelasDoPortal: {},
  pronto: false,
};

const managerClient = fs.readFileSync(
  new URL("../ominisaber-manager-client.js", import.meta.url),
  "utf8",
);
const updateProfileBody =
  managerClient.match(
    /const updateManagerProfile\s*=\s*async[\s\S]*?\n\s*const listManagerLinks/,
  )?.[0] || "";
checks.atualizacaoPerfilAtomica =
  (updateProfileBody.match(/\.update\(/g) || []).length === 1 &&
  updateProfileBody.includes(
    '.select("*,turmas!perfis_turma_id_fkey(id,nome,serie)")',
  ) &&
  !updateProfileBody.includes("optionalFields");

const core = await admin
  .from("perfis")
  .select("id,turma_id,curso_tecnico,tipo_professor", {
    head: true,
    count: "exact",
  });
checks.perfis = !core.error;
checks.turmaECurso = !core.error;

const portalColumns = await admin
  .from("perfis")
  .select("id,email_contato,ativo,primeiro_acesso_pendente,ultimo_acesso_em", {
    head: true,
    count: "exact",
  });
checks.camposDoPortal = !portalColumns.error;

for (const table of [
  "descritores_curriculares",
  "solicitacoes_acesso",
  "gestor_auditoria",
]) {
  const result = await admin
    .from(table)
    .select("id", { head: true, count: "exact" });
  checks.tabelasDoPortal[table] = !result.error;
}

checks.pronto =
  checks.turmaECurso &&
  checks.camposDoPortal &&
  checks.atualizacaoPerfilAtomica &&
  Object.values(checks.tabelasDoPortal).every(Boolean);
console.log(JSON.stringify(checks, null, 2));

if (!checks.turmaECurso) process.exitCode = 1;
if (!checks.pronto) {
  console.error(
    "\nO portal do gestor ainda não passou em todas as verificações de estrutura e persistência.",
  );
}
