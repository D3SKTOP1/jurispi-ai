/**
 * FERRAMENTA DE MAPEAMENTO (dev) — captura o fluxo autenticado de GRU.
 *
 * Loga no portal e-INPI (meu.inpi.gov.br/pag) e salva o HTML das telas
 * pós-login + os JS que dirigem os fluxos, para implementar emissão e
 * consulta de GRU. A senha nunca é impressa.
 *
 * Credencial: lida do COFRE do banco pela organização
 *   `npx tsx scripts/capture-gru.ts <organizationId>`
 * (usa a credencial que o cliente conectou na tela; nada em .env). Como o
 * cofre é decifrado direto aqui (credential-vault), o script NÃO importa o
 * einpi-credential-service — que puxa `server-only` e não roda fora do Next.
 *
 * Saída em scripts/.gru-capture/ (git-ignorado). Contém dados da conta —
 * revise antes de compartilhar.
 *
 * Mapa dos endpoints já descobertos: veja docs/gru-mapping.md.
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { randomBytes } from "crypto";

import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "../src/lib/inpi/gru/credential-vault";

const BASE = process.env.INPI_GRU_BASE_URL ?? "https://meu.inpi.gov.br";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const OUT = path.join(__dirname, ".gru-capture");
const prisma = new PrismaClient();

const jar = new Map<string, string>();
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
function store(res: Response) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
const pathOf = (loc: string) => {
  try {
    const u = new URL(loc, BASE);
    return `${u.pathname}${u.search}`;
  } catch {
    return loc.startsWith("/") ? loc : `/${loc}`;
  }
};

async function req(pathname: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${pathname}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(25_000),
    ...init,
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
      ...(init?.headers ?? {}),
    },
  });
  store(res);
  return { status: res.status, html: await res.text(), location: res.headers.get("location") ?? undefined };
}

/** Segue redirects manualmente logando cada hop; devolve a página final. */
async function follow(label: string, start: string, method: "GET" | "POST" = "GET", body?: string) {
  let p = start;
  let r = await req(
    p,
    method === "POST"
      ? {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: BASE, Referer: `${BASE}/pag/` },
          body,
        }
      : undefined
  );
  console.log(`  [${label}] ${method} ${p} → ${r.status}${r.location ? " → " + r.location : ""}`);
  for (let hop = 0; hop < 8 && r.status >= 300 && r.status < 400 && r.location; hop += 1) {
    p = pathOf(r.location);
    r = await req(p);
    console.log(`         ↳ GET ${p} → ${r.status}${r.location ? " → " + r.location : ""}`);
  }
  return { ...r, finalPath: p };
}

async function main() {
  const orgId = process.argv[2];
  const row = orgId ? await prisma.inpiEinpiCredential.findUnique({ where: { organizationId: orgId } }) : null;
  if (!row) {
    console.error("Uso: npx tsx scripts/capture-gru.ts <organizationId> (com conta e-INPI conectada no cofre).");
    process.exit(1);
  }
  const login = decryptSecret(row.loginEncrypted);
  const senha = decryptSecret(row.senhaEncrypted);
  mkdirSync(OUT, { recursive: true });

  const tabId = `tab-${randomBytes(6).toString("hex").slice(0, 9)}`;

  console.log("Autenticando no e-INPI (senha não é exibida)...");
  await req("/pag/"); // obtém JSESSIONID
  jar.set("sessionStorageValue", tabId);
  const body = new URLSearchParams({
    "usuario.tab_id": tabId,
    "usuario.browser": "chrome/126.0.0.0",
    "usuario.login": login,
    "usuario.senha": senha,
  }).toString();
  const landing = await follow("autenticar", "/pag/autenticar", "POST", body);
  if (/name="usuario\.senha"|id="loginForm"/i.test(landing.html)) {
    console.error("Login recusado (voltou à tela de login). Verifique a credencial.");
    process.exit(1);
  }
  writeFileSync(path.join(OUT, "10-emissao-gerar.html"), landing.html);
  console.log(`Login OK. Landing autenticado: ${landing.finalPath}`);

  // Telas conhecidas (ver docs/gru-mapping.md) + os JS que as dirigem.
  const pages = ["/pag/gru/gerar", "/pag/minhasgrus/"];
  for (const c of pages) {
    const r = await follow(c, c);
    writeFileSync(path.join(OUT, `2x${c.replace(/\W+/g, "_")}.html`), r.html);
    console.log(`  ${c}: ${r.status} ${r.html.length}b`);
  }
  const jsFiles = [
    "/pag/js/pagina/gru/index.js",
    "/pag/js/pagina/gru/modal.js",
    "/pag/js/pagina/gru/preencherSelect.js",
  ];
  for (const js of jsFiles) {
    const r = await req(js);
    writeFileSync(path.join(OUT, js.replace(/\W+/g, "_") + ".js"), r.html);
    console.log(`  ${js}: ${r.status} ${r.html.length}b`);
  }

  console.log(`\nArquivos em: ${OUT}\nRevise e me avise que estão prontos para eu mapear/implementar.`);
}

main()
  .catch((e) => {
    console.error("FALHOU:", e?.name, e?.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
