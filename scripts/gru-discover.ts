/**
 * DESCOBERTA (dev, read-only) — lista as opções da conta e-INPI para montar
 * um teste de emissão de GRU: tipos de serviço (diretorias) e clientes
 * cadastrados. Não emite nada, não gera custo.
 *
 *   npx tsx scripts/gru-discover.ts <organizationId>
 *
 * Documentos de clientes são mascarados na saída (PII).
 */
import "dotenv/config";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "../src/lib/inpi/gru/credential-vault";

const BASE = process.env.INPI_GRU_BASE_URL ?? "https://meu.inpi.gov.br";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
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
      Accept: "application/json, text/html;q=0.9,*/*;q=0.8",
      "X-Requested-With": "XMLHttpRequest",
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
      ...(init?.headers ?? {}),
    },
  });
  store(res);
  return { status: res.status, body: await res.text(), location: res.headers.get("location") ?? undefined };
}
function maskDoc(d?: string) {
  if (!d) return d;
  const s = String(d).replace(/\D/g, "");
  if (s.length < 5) return "•".repeat(s.length);
  return `${s.slice(0, 2)}${"•".repeat(s.length - 4)}${s.slice(-2)}`;
}
function tryJson(body: string) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function main() {
  const orgId = process.argv[2];
  const row = orgId ? await prisma.inpiEinpiCredential.findUnique({ where: { organizationId: orgId } }) : null;
  if (!row) {
    console.error("Uso: npx tsx scripts/gru-discover.ts <organizationId>");
    process.exit(1);
  }
  const login = decryptSecret(row.loginEncrypted);
  const senha = decryptSecret(row.senhaEncrypted);
  const tabId = `tab-${randomBytes(6).toString("hex").slice(0, 9)}`;

  await req("/pag/");
  jar.set("sessionStorageValue", tabId);
  let auth = await req("/pag/autenticar", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: BASE, Referer: `${BASE}/pag/` },
    body: new URLSearchParams({
      "usuario.tab_id": tabId,
      "usuario.browser": "chrome/126.0.0.0",
      "usuario.login": login,
      "usuario.senha": senha,
    }).toString(),
  });
  for (let h = 0; h < 6 && auth.status >= 300 && auth.status < 400 && auth.location; h++) {
    auth = await req(pathOf(auth.location));
  }
  if (/id="loginForm"/i.test(auth.body)) {
    console.error("Login recusado.");
    process.exit(1);
  }
  console.log("Login OK.\n");

  console.log("=== Tipos de serviço (diretorias) — /gru/buscar/tipoServico ===");
  const tipos = await req("/pag/gru/buscar/tipoServico");
  const tiposJson = tryJson(tipos.body);
  if (Array.isArray(tiposJson)) {
    for (const t of tiposJson) console.log(`  [${t.codigo}] ${t.nome ?? t.descricao ?? JSON.stringify(t)}`);
  } else {
    console.log(`  (status ${tipos.status}) resposta não-JSON: ${tipos.body.slice(0, 200)}`);
  }

  console.log("\n=== Clientes cadastrados — /gru/buscar/cliente/0?parametro=0 ===");
  const cli = await req("/pag/gru/buscar/cliente/0?parametro=0");
  const cliJson = tryJson(cli.body);
  if (Array.isArray(cliJson)) {
    console.log(`  ${cliJson.length} cliente(s):`);
    for (const c of cliJson.slice(0, 40)) {
      console.log(`  - ${c.nome ?? c.razaoSocial ?? "?"}  (doc ${maskDoc(c.documento ?? c.cpfCnpj ?? c.cnpj ?? c.cpf)}, cod ${c.codigo ?? c.id ?? "?"})`);
    }
  } else {
    console.log(`  (status ${cli.status}) resposta não-JSON: ${cli.body.slice(0, 200)}`);
  }
}

main()
  .catch((e) => console.error("FALHOU:", e?.name, e?.message))
  .finally(() => prisma.$disconnect());
