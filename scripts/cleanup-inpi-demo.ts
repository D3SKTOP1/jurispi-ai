/**
 * Remove da base os dados de DEMONSTRAÇÃO da integração INPI:
 * marcas/patentes fictícias dos CSVs embutidos, a edição fictícia da
 * RPI (2799) e as edições históricas de demonstração (2797, 2798),
 * import jobs MOCK e os alertas gerados a partir da RPI fictícia.
 *
 * NÃO toca em dados de organizações (casos, clientes, documentos,
 * processos monitorados) nem em dados importados de fontes reais.
 *
 * Uso:
 *   npx tsx scripts/cleanup-inpi-demo.ts            # dry-run (só mostra)
 *   npx tsx scripts/cleanup-inpi-demo.ts --apply    # executa a remoção
 */
import "dotenv/config";

import { readFileSync } from "fs";
import path from "path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const FIXTURES_DIR = path.join(process.cwd(), "src", "lib", "inpi", "fixtures");

/**
 * Fonte gravada pelos imports de demonstração — em produção o valor é
 * "Dados Abertos INPI (demonstração)". O filtro por "demonstra" cobre
 * variações e nunca casa com a fonte real ("RPI — Revista da…").
 */
const DEMO_SOURCE_FILTER = { contains: "demonstra" } as const;

/** Edições de RPI criadas pelo seed de demonstração. */
const DEMO_RPI_NUMBERS = ["2797", "2798", "2799"];

function fixtureProcessNumbers(csvFile: string): string[] {
  const raw = readFileSync(path.join(FIXTURES_DIR, csvFile), "utf-8");
  return raw
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(";")[0]?.trim())
    .filter((n): n is string => Boolean(n))
    .map((n) => n.replace(/[^0-9a-zA-Z]/g, "").toUpperCase());
}

function fixtureRpiProcessNumbers(): string[] {
  const raw = readFileSync(path.join(FIXTURES_DIR, "rpi-2799.xml"), "utf-8");
  return [...raw.matchAll(/processo="([^"]+)"/g)].map((m) =>
    m[1].replace(/[^0-9a-zA-Z]/g, "").toUpperCase()
  );
}

async function main() {
  console.log(`🧹 Limpeza dos dados demo INPI — ${APPLY ? "APLICANDO" : "dry-run (use --apply para executar)"}\n`);

  const demoTrademarks = [
    ...new Set([...fixtureProcessNumbers("dados-abertos-marcas.csv"), ...fixtureRpiProcessNumbers()]),
  ];
  const demoPatents = [
    ...new Set([...fixtureProcessNumbers("dados-abertos-patentes.csv"), ...fixtureRpiProcessNumbers()]),
  ];

  // 1. Marcas fictícias — só as importadas pela fonte de demonstração
  //    (o mesmo número pode existir legitimamente na base real do INPI).
  const tmWhere = {
    processNumber: { in: demoTrademarks },
    source: DEMO_SOURCE_FILTER,
  };
  const tmCount = await prisma.inpiTrademark.count({ where: tmWhere });

  // 2. Patentes fictícias.
  const patWhere = {
    processNumber: { in: demoPatents },
    source: DEMO_SOURCE_FILTER,
  };
  const patCount = await prisma.inpiPatent.count({ where: patWhere });

  // 3. Réplicas de despacho da RPI fictícia (2799) — restritas aos
  //    processos fictícios para nunca atingir uma RPI 2799 real.
  const tmDispatchWhere = {
    rpiNumber: { in: DEMO_RPI_NUMBERS },
    processNumber: { in: demoTrademarks },
  };
  const patDispatchWhere = {
    rpiNumber: { in: DEMO_RPI_NUMBERS },
    processNumber: { in: demoPatents },
  };
  const tmDispatchCount = await prisma.inpiTrademarkDispatch.count({ where: tmDispatchWhere });
  const patDispatchCount = await prisma.inpiPatentDispatch.count({ where: patDispatchWhere });

  // 4. Edições fictícias da RPI (metadata de fixture/nota de demonstração).
  const demoIssues = await prisma.rpiIssue.findMany({
    where: { number: { in: DEMO_RPI_NUMBERS } },
    select: { id: true, number: true, sourceUrl: true, metadata: true },
  });
  const fixtureIssues = demoIssues.filter((i) => {
    const meta = (i.metadata ?? {}) as { fixture?: string; note?: string };
    return (
      Boolean(meta.fixture) ||
      Boolean(meta.note?.includes("demonstração")) ||
      i.sourceUrl?.startsWith("fixture://")
    );
  });

  // 5. Import jobs de demonstração (MOCK + o job da RPI fixture).
  const jobWhere = {
    OR: [{ sourceType: "MOCK" }, { fileName: { startsWith: "rpi-2799" } }],
  };
  const jobCount = await prisma.inpiImportJob.count({ where: jobWhere });

  // 6. Alertas criados a partir da RPI fictícia.
  const alertWhere = {
    metadata: { path: ["rpiNumber"], equals: "2799" },
  };
  const alertCount = await prisma.alert.count({ where: alertWhere });

  // 7. Fontes de demonstração.
  const sourceWhere = { type: "MOCK" };
  const sourceCount = await prisma.inpiSource.count({ where: sourceWhere });

  console.log(`   Marcas fictícias:                ${tmCount} (de ${demoTrademarks.length} números demo)`);
  console.log(`   Patentes fictícias:              ${patCount} (de ${demoPatents.length} números demo)`);
  console.log(`   Réplicas de despacho (marcas):   ${tmDispatchCount}`);
  console.log(`   Réplicas de despacho (patentes): ${patDispatchCount}`);
  console.log(`   Edições fictícias da RPI:        ${fixtureIssues.map((i) => i.number).join(", ") || "nenhuma"}`);
  console.log(`   Import jobs de demonstração:     ${jobCount}`);
  console.log(`   Alertas da RPI fictícia:         ${alertCount}`);
  console.log(`   Fontes MOCK:                     ${sourceCount}`);

  const monitoredDemo = await prisma.monitoredProcess.findMany({
    where: { processNumber: { in: [...demoTrademarks, ...demoPatents] } },
    select: { processNumber: true, title: true, organizationId: true },
  });
  if (monitoredDemo.length > 0) {
    console.log(
      `\n   ⚠️ ${monitoredDemo.length} processo(s) monitorado(s) apontam para números fictícios ` +
        `(dados de organização — NÃO serão removidos):`
    );
    for (const m of monitoredDemo) {
      console.log(`      - ${m.processNumber} (${m.title ?? "sem título"})`);
    }
  }

  if (!APPLY) {
    console.log("\nDry-run concluído. Rode com --apply para remover.");
    return;
  }

  console.log("\n   Removendo…");
  const r1 = await prisma.inpiTrademarkDispatch.deleteMany({ where: tmDispatchWhere });
  const r2 = await prisma.inpiPatentDispatch.deleteMany({ where: patDispatchWhere });
  const r3 = await prisma.inpiTrademark.deleteMany({ where: tmWhere });
  const r4 = await prisma.inpiPatent.deleteMany({ where: patWhere });
  const r5 = await prisma.rpiIssue.deleteMany({
    where: { id: { in: fixtureIssues.map((i) => i.id) } },
  });
  const r6 = await prisma.inpiImportJob.deleteMany({ where: jobWhere });
  const r7 = await prisma.alert.deleteMany({ where: alertWhere });
  const r8 = await prisma.inpiSource.deleteMany({ where: sourceWhere });

  console.log(`   ✅ Removidos: ${r3.count} marcas, ${r4.count} patentes, ` +
    `${r1.count + r2.count} réplicas de despacho, ${r5.count} edições RPI ` +
    `(seções/despachos em cascata), ${r6.count} import jobs, ${r7.count} alertas, ${r8.count} fontes.`);

  const [tmLeft, patLeft, dispatchLeft] = await Promise.all([
    prisma.inpiTrademark.count(),
    prisma.inpiPatent.count(),
    prisma.rpiDispatch.count(),
  ]);
  console.log(`\n   Base após limpeza: ${tmLeft} marcas · ${patLeft} patentes · ${dispatchLeft} despachos RPI.`);
}

main()
  .catch((error) => {
    console.error("❌ Erro na limpeza:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
