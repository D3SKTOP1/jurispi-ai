/**
 * Seed de demonstração da integração INPI.
 * Executa o pipeline REAL de ingestão sobre os fixtures embutidos:
 * fontes → import jobs → staging → normalização → RPI → matching → alertas.
 *
 * Execução: npm run db:seed:inpi  (após npm run db:seed)
 * Idempotente: checksums e dedupes impedem duplicação.
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { ensureDefaultSources } from "../src/lib/inpi/inpi-source-registry";
import { syncOpenDataSources } from "../src/lib/inpi/jobs/sync-open-data-job";
import { inpiMonitoringService } from "../src/lib/inpi/monitoring/inpi-monitoring-service";
import { trademarkSearchService } from "../src/lib/inpi/search/trademark-search-service";

const prisma = new PrismaClient();

/** Aquece a conexão (Neon pode estar em cold start) com retries. */
async function warmUp() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      console.log(`   Aguardando banco acordar (tentativa ${attempt})…`);
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
}

async function main() {
  console.log("🏛️  Seed da integração INPI…");
  // Seed é o caminho de demonstração: habilita os fixtures embutidos
  // (descoberta e sync da RPI 2799 fictícia) apenas neste processo.
  process.env.INPI_ENABLE_FIXTURES = "true";
  await warmUp();

  // 1. Fontes INPI (Dados Abertos, RPI, Portal mock, Fixtures).
  const sources = await ensureDefaultSources();
  console.log(`   Fontes registradas: ${sources.length}`);

  // 2-4. Pipeline de dados abertos: 2 import jobs → 10 marcas + 5 patentes.
  const openData = await syncOpenDataSources({ allowFixtures: true });
  console.log(
    `   Dados abertos: marcas ${openData.trademarks.skipped ? "(já importadas)" : `+${openData.trademarks.created}`}, ` +
      `patentes ${openData.patents.skipped ? "(já importadas)" : `+${openData.patents.created}`}`
  );

  // 5. Organização demo (tenant) para monitoramento e alertas.
  const org = await prisma.organization.findUnique({
    where: { slug: "escritorio-demo-pi" },
    include: { cases: { select: { id: true, title: true, processNumber: true, clientId: true } } },
  });

  if (!org) {
    console.warn(
      "   ⚠️ Organização demo não encontrada — rode `npm run db:seed` antes. Pulando monitoramento/alertas."
    );
  } else {
    const caseSerrano = org.cases.find((c) => c.processNumber === "912345678");
    const caseAgroSense = org.cases.find((c) => c.processNumber === "913456789");
    const casePatente = org.cases.find((c) => c.processNumber?.startsWith("BR102024"));

    // 3 processos monitorados (números presentes na RPI de demonstração).
    const monitoredData = [
      {
        processNumber: "912345678",
        type: "TRADEMARK",
        title: "Marca Café Serrano (cliente Café Serrano Ltda.)",
        caseId: caseSerrano?.id ?? null,
        clientId: caseSerrano?.clientId ?? null,
      },
      {
        processNumber: "913456789",
        type: "TRADEMARK",
        title: "Marca AgroSense (cliente TechNova)",
        caseId: caseAgroSense?.id ?? null,
        clientId: caseAgroSense?.clientId ?? null,
      },
      {
        processNumber: "BR1020240012345",
        type: "PATENT",
        title: "Patente irrigação IoT (cliente TechNova)",
        caseId: casePatente?.id ?? null,
        clientId: casePatente?.clientId ?? null,
      },
    ] as const;

    for (const m of monitoredData) {
      await prisma.monitoredProcess.upsert({
        where: {
          organizationId_processNumber: {
            organizationId: org.id,
            processNumber: m.processNumber,
          },
        },
        create: { organizationId: org.id, ...m },
        update: { isActive: true },
      });
    }
    console.log(`   Processos monitorados: ${monitoredData.length}`);
  }

  // 6-7. RPI: descoberta + sync da edição de demonstração (2799) —
  // parseia 10 despachos e cria alertas para os processos monitorados.
  await inpiMonitoringService.discoverLatestRpiIssues();
  const sync = await inpiMonitoringService.syncRpiIssue("2799").catch((error) => {
    console.warn(`   ⚠️ Sync RPI 2799: ${error instanceof Error ? error.message : error}`);
    return { dispatchesCreated: 0, alertsCreated: 0 };
  });
  console.log(
    `   RPI 2799: ${sync.dispatchesCreated} despachos novos, ${sync.alertsCreated} alertas criados`
  );

  // Mais duas edições registradas (histórico de demonstração).
  for (const issue of [
    { number: "2797", publishedAt: new Date("2026-06-23"), status: "PROCESSED" },
    { number: "2798", publishedAt: new Date("2026-06-30"), status: "PROCESSED" },
  ]) {
    await prisma.rpiIssue.upsert({
      where: { number: issue.number },
      create: {
        ...issue,
        sourceUrl: "https://revistas.inpi.gov.br",
        metadata: { note: "Edição histórica de demonstração (sem arquivo estruturado)." },
      },
      update: {},
    });
  }

  // 8-9. Análise de risco de marca real (heurística sobre a base importada).
  if (org) {
    const riskTitle = "Análise de risco INPI — Bella Moda (classe 25)";
    const existingRisk = await prisma.generatedDocument.findFirst({
      where: { organizationId: org.id, title: riskTitle },
    });
    if (!existingRisk) {
      const risk = await trademarkSearchService.analyzeTrademarkRisk({
        brandName: "Bella Moda",
        niceClasses: ["25"],
      });
      const caseBella = await prisma.trademarkCase.findFirst({
        where: { brandName: "Bella Moda", case: { organizationId: org.id } },
        select: { caseId: true },
      });
      await prisma.generatedDocument.create({
        data: {
          organizationId: org.id,
          caseId: caseBella?.caseId ?? null,
          type: "PRELIMINARY_OPINION",
          title: riskTitle,
          status: "DRAFT",
          content: `ANÁLISE PRELIMINAR DE RISCO — BASE INPI IMPORTADA

Marca analisada: BELLA MODA (classe 25)
Nível de risco: ${risk.riskLevel} (score ${risk.score}/100)

Fatores identificados:
${risk.reasons.map((r) => `- ${r}`).join("\n")}

Marcas semelhantes na base (${risk.similarMarks.length}):
${risk.similarMarks
  .map(
    (m) =>
      `- ${m.brandName} — processo ${m.processNumber}; classes ${m.niceClasses.join(", ") || "—"}; status: ${m.status ?? "?"}${m.similarity !== undefined ? `; similaridade ${(m.similarity * 100).toFixed(0)}%` : ""}`
  )
  .join("\n")}

${risk.disclaimer}`,
        },
      });
      console.log(`   Análise de risco criada: ${risk.riskLevel} (score ${risk.score})`);
    }

    // 10. Análise preliminar de patente vinculada a dado importado.
    const patentTitle = "Análise preliminar INPI — Visão computacional para inspeção de soldas";
    const existingPatent = await prisma.generatedDocument.findFirst({
      where: { organizationId: org.id, title: patentTitle },
    });
    if (!existingPatent) {
      await prisma.generatedDocument.create({
        data: {
          organizationId: org.id,
          type: "PATENT_ANALYSIS",
          title: patentTitle,
          status: "DRAFT",
          content: `ANÁLISE TÉCNICA PRELIMINAR — BASE INPI IMPORTADA

Referência: processo BR1020240067890 — "Sistema de visão computacional para inspeção de soldas industriais" (Solvercam Sistemas Digitais Ltda.), IPC G06T 7/00 | B23K 31/12, status: aguardando exame técnico.

1. Campo tecnológico: visão computacional aplicada a controle de qualidade industrial.
2. Possíveis anterioridades: sistemas comerciais de inspeção óptica automatizada (AOI); publicações sobre deep learning para detecção de defeitos de solda. Busca formal de anterioridade recomendada (INPI, Espacenet, Patentscope).
3. Pontos de atenção: a combinação câmera + ML embarcado é campo denso; a novidade tende a residir em detalhes do pipeline de processamento e da integração em linha.
4. Próximos passos: busca de anterioridade formal; acompanhamento do exame técnico via monitoramento da RPI na plataforma.

Fonte: Dados Abertos INPI (demonstração). Análise assistiva — não substitui busca de anterioridade formal nem o exame do INPI.`,
        },
      });
      console.log("   Análise preliminar de patente criada.");
    }
  }

  // Contagens sequenciais: conexões concorrentes novas podem falhar em
  // ambientes com cold start / rede instável.
  const trademarks = await prisma.inpiTrademark.count();
  const patents = await prisma.inpiPatent.count();
  const dispatches = await prisma.rpiDispatch.count();
  const issues = await prisma.rpiIssue.count();
  const jobs = await prisma.inpiImportJob.count();

  console.log("✅ Seed INPI concluído:");
  console.log(`   Marcas globais: ${trademarks} · Patentes globais: ${patents}`);
  console.log(`   Edições RPI: ${issues} · Despachos: ${dispatches} · Import jobs: ${jobs}`);
}

main()
  .catch((error) => {
    console.error("❌ Erro no seed INPI:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
