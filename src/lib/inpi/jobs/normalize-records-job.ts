import { prisma } from "@/lib/db";

import { logSync } from "../inpi-source-registry";
import {
  normalizeTrademarkRecord,
  trademarkRecordFromCsvRow,
} from "../normalizers/trademark-normalizer";
import {
  normalizePatentRecord,
  patentRecordFromCsvRow,
} from "../normalizers/patent-normalizer";

/**
 * Normalização staging → tabelas globais.
 * Processa InpiRawRecord com status PENDING; upsert por processNumber;
 * falhas ficam registradas no próprio registro (status FAILED).
 */

async function normalizePendingRecords(
  entityType: "TRADEMARK" | "PATENT",
  importJobId?: string
): Promise<{ processed: number; failed: number }> {
  const records = await prisma.inpiRawRecord.findMany({
    where: {
      entityType,
      status: "PENDING",
      ...(importJobId ? { rawFile: { importJobId } } : {}),
    },
    include: { rawFile: { select: { sourceType: true, importJobId: true } } },
    take: 5_000,
  });

  let processed = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const row = record.rawData as Record<string, string>;
      const source =
        record.rawFile.sourceType === "MOCK" ? "Dados Abertos INPI (demonstração)" : "Dados Abertos INPI";

      if (entityType === "TRADEMARK") {
        const parsed = trademarkRecordFromCsvRow(row);
        if (!parsed) throw new Error("Linha sem numero_processo/marca.");
        await normalizeTrademarkRecord(parsed, source);
      } else {
        const parsed = patentRecordFromCsvRow(row);
        if (!parsed) throw new Error("Linha sem numero_processo/titulo.");
        await normalizePatentRecord(parsed, source);
      }

      await prisma.inpiRawRecord.update({
        where: { id: record.id },
        data: { status: "NORMALIZED", errorMessage: null },
      });
      processed += 1;
    } catch (error) {
      failed += 1;
      await prisma.inpiRawRecord.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          errorMessage: (error instanceof Error ? error.message : "erro").slice(0, 400),
        },
      });
    }
  }

  return { processed, failed };
}

/** Normaliza todos os registros PENDING de um import job e atualiza contadores. */
export async function normalizeRawRecordsForJob(importJobId: string) {
  const job = await prisma.inpiImportJob.findUnique({ where: { id: importJobId } });
  if (!job) throw new Error("Import job não encontrado.");

  const entityType = job.entityType as "TRADEMARK" | "PATENT";
  const { processed, failed } = await normalizePendingRecords(entityType, importJobId);

  await prisma.inpiImportJob.update({
    where: { id: importJobId },
    data: {
      processedRecords: { increment: processed },
      failedRecords: { increment: failed },
    },
  });

  if (failed > 0) {
    await logSync({
      jobId: importJobId,
      level: "WARN",
      message: `${failed} registro(s) falharam na normalização.`,
    });
  }

  return { processed, failed };
}

export async function normalizeTrademarkRecords() {
  return normalizePendingRecords("TRADEMARK");
}

export async function normalizePatentRecords() {
  return normalizePendingRecords("PATENT");
}

/**
 * Despachos da RPI são normalizados durante o sync da edição
 * (InpiMonitoringService). Este job cobre reprocessamento de registros
 * de staging de RPI que tenham ficado pendentes.
 */
export async function normalizeRpiDispatches(): Promise<{ processed: number }> {
  const pending = await prisma.inpiRawRecord.count({
    where: { entityType: "RPI_DISPATCH", status: "PENDING" },
  });
  if (pending > 0) {
    await logSync({
      level: "WARN",
      message: `${pending} registro(s) de RPI em staging — reprocesse a edição correspondente (syncRpiIssue).`,
    });
  }
  return { processed: 0 };
}
