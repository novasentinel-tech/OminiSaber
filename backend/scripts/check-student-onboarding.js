import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const shell = read("frontend", "Parties", "parties.js");
const onboarding = read("frontend", "Parties", "student-onboarding.js");
const styles = read("frontend", "Parties", "student-onboarding.css");
const help = read("frontend", "aluno", "ajuda-suporte", "index.html");

const checks = [
  ["shell carrega tutorial apenas para aluno", shell.includes("loadStudentOnboarding")],
  ["estado é separado por aluno e versão", onboarding.includes("student-onboarding:${VERSION}:${userId}")],
  ["boas-vindas usa diálogo acessível", onboarding.includes('setAttribute("aria-labelledby", "os-student-welcome-title")')],
  ["ilustração real é usada", onboarding.includes("student-onboarding.png")],
  ["passeio cobre dez áreas", (onboarding.match(/folder:/g) || []).length === 10],
  ["passeio continua entre páginas", onboarding.includes('status: "active"') && onboarding.includes("window.location.href = stepUrl")],
  ["ajuda permite rever o tutorial", onboarding.includes("data-student-tour-restart") && help.includes("help-hero")],
  ["usuário pode pular", onboarding.includes("Pular tutorial")],
  ["preferência não mostrar novamente existe", onboarding.includes("data-welcome-never")],
  ["teclado pode fechar o passeio", onboarding.includes('event.key === "Escape"')],
  ["layout móvel possui orientação inferior", styles.includes("bottom: calc(82px + env(safe-area-inset-bottom))")],
  ["telas baixas abandonam a grade de duas colunas", styles.includes("@media (max-height: 700px) and (min-width: 421px)") && styles.includes("grid-template-columns: minmax(0, 1fr)")],
  ["regra de celular não é misturada com altura reduzida", styles.includes("@media (max-width: 420px) {")],
  ["movimento reduzido é respeitado", styles.includes("prefers-reduced-motion")],
  ["foco visível foi definido", styles.includes(":focus-visible")],
];

let failed = 0;
for (const [label, condition] of checks) {
  console.log(`${condition ? "OK  " : "FAIL"} ${label}`);
  if (!condition) failed += 1;
}
if (failed) process.exitCode = 1;

