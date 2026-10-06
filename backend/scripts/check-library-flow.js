import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const publicKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !secretKey)
  throw new Error("Configuração do Supabase incompleta no .env.");

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const studentPassword = process.env.TEST_STUDENT_PASSWORD || "senha123aluno";
const librarianPassword =
  process.env.TEST_LIBRARIAN_PASSWORD || "senha123bibliotecaria";
const result = {
  host: new URL(url).host,
  tables: {},
  storage: { bucket: false },
  studentAccount: false,
  librarianAccount: false,
  studentRls: false,
  separationRpc: false,
  diagnostics: {},
};

for (const table of [
  "livros",
  "exemplares",
  "secoes_fisicas",
  "solicitacoes_emprestimo",
  "materiais_biblioteca",
  "notificacoes",
]) {
  const query = await admin
    .from(table)
    .select("id", { count: "exact", head: true });
  result.tables[table] = query.error
    ? { available: false, code: query.error.code }
    : { available: true, count: query.count || 0 };
}
const materialColumns = await admin
  .from("materiais_biblioteca")
  .select(
    "id,titulo,autor,descricao,categoria,materia,paginas,capa_url,palavras_chave,storage_bucket,storage_path,nome_arquivo,mime_type,tamanho_bytes,verificado,verificado_por,verificado_em,publicado,criado_por,created_at,updated_at",
    { count: "exact", head: true },
  );
result.tables.materiais_biblioteca.columnsReady = !materialColumns.error;

const buckets = await admin.storage.listBuckets();
if (!buckets.error)
  result.storage.bucket = (buckets.data || []).some(
    (bucket) => bucket.id === "biblioteca-pdfs" && !bucket.public,
  );
const browser = createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = await browser.rpc("email_por_matricula", {
  matricula_input: "useraluno",
});
if (!email.error && email.data) {
  result.studentAccount = true;
  const login = await browser.auth.signInWithPassword({
    email: email.data,
    password: studentPassword,
  });
  if (!login.error) {
    const books = await browser
      .from("livros")
      .select("id", { count: "exact", head: true });
    const requests = await browser
      .from("solicitacoes_emprestimo")
      .select("id", { count: "exact", head: true });
    result.studentRls = !books.error && !requests.error;
    if (books.error || requests.error) {
      result.diagnostics.studentAccess =
        books.error?.code || requests.error?.code;
    }
    await browser.auth.signOut();
  } else {
    result.diagnostics.studentLogin =
      login.error.status || login.error.code || "login_failed";
  }
} else {
  result.diagnostics.studentLookup =
    email.error?.code || "registration_not_found";
}

const staffEmail = await browser.rpc("email_por_matricula", {
  matricula_input: "userbibliotecaria",
});
if (!staffEmail.error && staffEmail.data) {
  result.librarianAccount = true;
  const login = await browser.auth.signInWithPassword({
    email: staffEmail.data,
    password: librarianPassword,
  });
  if (!login.error) {
    const rpc = await browser.rpc("biblioteca_separar_solicitacao", {
      p_solicitacao_id: "00000000-0000-0000-0000-000000000000",
    });
    result.separationRpc =
      rpc.error?.code !== "PGRST202" && rpc.error?.code !== "42883";
    if (!result.separationRpc)
      result.diagnostics.separationRpc = rpc.error?.code;
    await browser.auth.signOut();
  } else {
    result.diagnostics.librarianLogin =
      login.error.status || login.error.code || "login_failed";
  }
} else {
  result.diagnostics.librarianLookup =
    staffEmail.error?.code || "registration_not_found";
}

console.log(JSON.stringify(result, null, 2));
const requiredTables = [
  "livros",
  "exemplares",
  "secoes_fisicas",
  "solicitacoes_emprestimo",
  "materiais_biblioteca",
  "notificacoes",
];
const failed =
  requiredTables.some((table) => !result.tables[table]?.available) ||
  !result.tables.materiais_biblioteca.columnsReady ||
  !result.storage.bucket ||
  !result.studentAccount ||
  !result.librarianAccount ||
  !result.studentRls ||
  !result.separationRpc;

if (failed) {
  console.error(
    "Fluxo integrado da biblioteca incompleto. Consulte diagnostics e providencie as contas/dados de teste ausentes.",
  );
  process.exitCode = 1;
}
