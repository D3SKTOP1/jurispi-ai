/**
 * Sincroniza a base INPI com a RPI oficial: descobre as edições mais
 * recentes e importa todas as pendentes (Marcas, Patentes e Programa de
 * computador), com progresso no console.
 *
 * Mesmo pipeline do botão "Atualizar base do INPI" — útil para a primeira
 * carga, execuções manuais e cron.
 *
 * Uso: npm run inpi:sync
 */
import "dotenv/config";

// Client compartilhado do app: é o mesmo que a ingestão usa — assim o
// $disconnect() do retry derruba de verdade a conexão problemática.
import { prisma } from "../src/lib/db";

/** Aquece a conexão (Neon pode estar em cold start). */
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
  console.log("🏛️  Sincronização da base INPI com a RPI oficial…\n");
  await warmUp();

  const { discoverRealRpiEditions } = await import("../src/lib/inpi/rpi-editions");
  const { syncRealRpiSlice } = await import("../src/lib/inpi/rpi-ingest");

  const { discovered, latestAvailable } = await discoverRealRpiEditions();
  console.log(
    `   Descoberta: ${discovered.length > 0 ? `novas edições ${discovered.join(", ")}` : "nenhuma edição nova"}` +
      ` (mais recente no INPI: ${latestAvailable ?? "?"})`
  );

  const pending = await prisma.rpiIssue.findMany({
    where: { status: { in: ["DISCOVERED", "PROCESSING"] } },
    orderBy: { number: "asc" },
    select: { number: true },
  });

  if (pending.length === 0) {
    console.log("\n✅ Base já atualizada — nada a importar.");
    return;
  }

  console.log(`   Edições pendentes: ${pending.map((p) => p.number).join(", ")}\n`);

  /**
   * Fatia com retry paciente: o Neon (e redes domésticas) derrubam
   * conexões no meio de cargas longas. Espera progressiva de até ~4 min
   * no total e força reconexão do Prisma entre tentativas.
   */
  const WAITS_MS = [5_000, 10_000, 20_000, 40_000, 60_000, 90_000];
  async function sliceWithRetry(rpiNumber: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await syncRealRpiSlice(rpiNumber);
      } catch (error) {
        const transient =
          error instanceof Error &&
          /P1001|P1017|P2024|ECONNRESET|ETIMEDOUT|ConnectionReset|Can't reach database|connection/i.test(
            String(error.message)
          );
        if (!transient || attempt >= WAITS_MS.length) throw error;
        const wait = WAITS_MS[attempt];
        console.log(
          `     conexão caiu (tentativa ${attempt + 1}/${WAITS_MS.length}) — aguardando ${wait / 1000}s…`
        );
        await prisma.$disconnect().catch(() => undefined);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  for (const issue of pending) {
    console.log(`   ▶ RPI ${issue.number}`);
    const t0 = Date.now();
    for (let i = 0; i < 500; i++) {
      const progress = await sliceWithRetry(issue.number);
      if (progress.revistaLabel && progress.totalChunks) {
        console.log(
          `     ${progress.revistaLabel}: ${progress.cursor}/${progress.totalChunks}` +
            (progress.dispatchesCreated ? ` (+${progress.dispatchesCreated} despachos)` : "") +
            (progress.alertsCreated !== undefined ? ` — ${progress.alertsCreated} alertas` : "")
        );
      } else {
        console.log(`     ${progress.message}`);
      }
      if (progress.done) break;
    }
    console.log(`   ✔ RPI ${issue.number} concluída em ${Math.round((Date.now() - t0) / 1000)}s\n`);
  }

  const [tm, pat, disp, issues] = await Promise.all([
    prisma.inpiTrademark.count(),
    prisma.inpiPatent.count(),
    prisma.rpiDispatch.count(),
    prisma.rpiIssue.count({ where: { status: "PROCESSED" } }),
  ]);
  console.log("✅ Sincronização concluída.");
  console.log(`   Base: ${tm.toLocaleString("pt-BR")} marcas · ${pat.toLocaleString("pt-BR")} patentes · ` +
    `${disp.toLocaleString("pt-BR")} despachos · ${issues} edições processadas.`);
}

main()
  .catch((error) => {
    console.error("❌ Erro na sincronização:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
