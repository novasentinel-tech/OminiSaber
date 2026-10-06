import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  authDestinationPages,
  htmlPublicDependencies,
  preflightPublicSources,
  publicCopies,
  validatePublicSupabaseConfig,
} from "../scripts/prepare-netlify-site.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("manager sidebar scrolls and collapses completely", async () => {
  const css = await read("frontend/gestor/shared/gestor-sidebar.css");
  const script = await read("frontend/gestor/shared/gestor-sidebar.js");
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /\.manager-sidebar::\-webkit-scrollbar/);
  assert.match(css, /left:\s*214px/);
  assert.match(script, /document\.body\.append\(button\)/);
  assert.match(css, /\.manager-sidebar-collapsed \.manager-sidebar\s*\{[^}]*translateX\(-105%\)/s);
  assert.match(css, /\.manager-sidebar-collapsed \.manager-main\s*\{[^}]*margin-left:\s*0/s);
  assert.match(css, /\.manager-sidebar-collapsed \.manager-sidebar-reopen\s*\{[^}]*opacity:\s*1/s);
});

test("manager sidebar uses the same tablet breakpoint as the layout", async () => {
  const script = await read("frontend/gestor/shared/gestor-sidebar.js");
  assert.match(script, /matchMedia\("\(max-width:900px\)"\)/);
});

test("teacher portal creates an origin-root OmniStudio URL", async () => {
  const script = await read("frontend/professor/specialty/portal.js");
  assert.match(script, /new URL\("\/oministudio\/", window\.location\.origin\)/);
  assert.match(script, /studio\.search = params\.toString\(\)/);
  assert.match(script, /studio\.hash = "choose"/);
});

test("Netlify publishes only the safe assembled site", async () => {
  const config = await read("netlify.toml");
  assert.match(config, /publish = "netlify-dist"/);
  assert.match(
    config,
    /npm --prefix engine ci && npm --prefix engine run build && node scripts\/prepare-netlify-site\.mjs/,
  );
  assert.deepEqual(publicCopies, [
    ["index.html"],
    ["frontend"],
    ["engine/dist/client"],
    ["engine/dist/client", "oministudio"],
    ["backend/ominisaber-supabase-config.js"],
    ["backend/ominisaber-supabase-client.js"],
    ["backend/ominisaber-manager-client.js"],
    ["backend/vendor/supabase-2.112.3.js"],
    ["ominisaber-sw.js"],
    ["ominisaber.webmanifest"],
    ["_headers"],
    ["_redirects"],
  ]);
  assert.match(config, /from = "\/oministudio\/\*"/);
  assert.match(config, /to = "\/oministudio\/index\.html"/);
});

test("Netlify preflight validates login dependencies and authenticated destinations without rewriting the package", async () => {
  const packageBefore = await read("netlify-dist/index.html");
  const loginFiles = await htmlPublicDependencies("frontend/login/index.html");
  assert.equal(loginFiles.length, 9);
  for (const required of [
    "frontend/login/index.html",
    "frontend/login/script.js",
    "frontend/login/style.css",
    "frontend/login/assets/jornada-ominisaber-3d.jpg",
    "backend/vendor/supabase-2.112.3.js",
    "backend/ominisaber-supabase-config.js",
    "backend/ominisaber-supabase-client.js",
    "frontend/Parties/parties.js",
    "frontend/Parties/parties.css",
  ]) assert.ok(loginFiles.includes(required), required);
  for (const page of [
    "frontend/aluno/dashboard_principal/index.html",
    "frontend/aluno/perfil/index.html",
    "frontend/redefinir-senha/index.html",
    "frontend/professor/professor_portugues/dashboard/index.html",
  ]) assert.ok(authDestinationPages.includes(page), page);
  const preflight = await preflightPublicSources();
  assert.ok(preflight.authenticationFiles >= loginFiles.length);
  assert.ok(["publishable", "legacy-anon"].includes(preflight.configuration.keyType));
  assert.equal(await read("netlify-dist/index.html"), packageBefore);
});

test("Netlify public configuration rejects secrets, private URLs and mismatched projects", () => {
  const configuration = (url, anonKey) => `window.OMINISABER_SUPABASE_CONFIG = {url: ${JSON.stringify(url)}, anonKey: ${JSON.stringify(anonKey)}};`;
  const jwt = role => [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(JSON.stringify({ role, ref: "project" })).toString("base64url"),
    "c2lnbmF0dXJl",
  ].join(".");
  const publicKey = "sb_publishable_fixture_public";
  assert.equal(validatePublicSupabaseConfig(configuration("https://project.supabase.co", publicKey)).keyType, "publishable");
  assert.equal(validatePublicSupabaseConfig(configuration("https://project.supabase.co", jwt("anon"))).keyType, "legacy-anon");
  for (const [url, key] of [
    ["https://project.supabase.co", "sb_secret_fixture_private"],
    ["https://project.supabase.co", jwt("service_role")],
    ["https://project.supabase.co", "not-a-public-key"],
    ["http://project.supabase.co", publicKey],
    ["https://192.168.1.1", publicKey],
    ["https://username:password@project.supabase.co", publicKey],
    ["https://different.supabase.co", jwt("anon")],
  ]) assert.throws(() => validatePublicSupabaseConfig(configuration(url, key)));
  assert.throws(() => validatePublicSupabaseConfig(configuration("https://project.supabase.co", publicKey) + " console.log(1);"));
});
