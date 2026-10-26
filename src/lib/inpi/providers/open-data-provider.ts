import { promises as fs } from "fs";
import path from "path";

import { prisma } from "@/lib/db";

import type { InpiProvider } from "../inpi-provider";
import { downloadPublicFile, saveInpiRawFile, checksumOf } from "../inpi-file-storage";
import { ensureDefaultSources, logSync } from "../inpi-source-registry";
import { parseCsv } from "../parsers/csv-parser";
import { trademarkSearchService } from "../search/trademark-search-service";
import { patentSearchService } from "../search/patent-search-service";
import type {
  InpiDispatchResult,
  InpiEntityType,
  InpiProcessResult,
  PatentSearchParams,
  PatentSearchResult,
  TrademarkSearchParams,
  TrademarkSearchResult,
} from "../types";

const FIXTURES_DIR = path.join(process.cwd(), "src", "lib", "inpi", "fixtures");

/**
 * OpenDataProvider — ingestão dos dados abertos do INPI.
 *
 * Pipeline: registra InpiImportJob → baixa/lê arquivo → checksum
 * (evita reimportação) → salva bruto → InpiRawFile → parse CSV →
 * InpiRawRecord (staging) → normalização (job) → tabelas globais.
 *
 * As buscas leem SEMPRE a base local (nunca o INPI ao vivo).
 */
export class OpenDataProvider implements InpiProvider {
  sourceName = "Dados Abertos INPI";

  async searchTrademark(params: TrademarkSearchParams): Promise<TrademarkSearchResult[]> {
    return trademarkSearchService.search(params);
  }

  async searchPatent(params: PatentSearchParams): Promise<PatentSearchResult[]> {
    return patentSearchService.search(params);
  }

  async getProcess(processNumber: string): Promise<InpiProcessResult | null> {
    const trademark = await trademarkSearchService.searchTrademarkByProcessNumber(processNumber);
    if (trademark) return { processNumber: trademark.processNumber, kind: "TRADEMARK", trademark };
    const patent = await patentSearchService.searchPatentByProcessNumber(processNumber);
    if (patent) return { processNumber: patent.processNumber, kind: "PATENT", patent };
    return null;
  }

  async getDispatches(processNumber: string): Promise<InpiDispatchResult[]> {
    const [tm, pt] = await Promise.all([
      trademarkSearchService.getDispatches(processNumber),
      patentSearchService.getDispatches(processNumber),
    ]);
    return [...tm, ...pt].map((d) => ({
      processNumber: d.processNumber,
      rpiNumber: d.rpiNumber,
      rpiDate: d.rpiDate,
      dispatchCode: d.dispatchCode,
      dispatchText: d.dispatchText,
      section: d.section,
      source: this.sourceName,
    }));
  }

  /**
   * Executa uma importação de dados abertos.
   * `fileUrl` baixa de fonte pública; `fixtureFile` usa arquivo de
   * demonstração embutido (pipeline completo sem rede).
   */
  async runImport(options: {
    entityType: Extract<InpiEntityType, "TRADEMARK" | "PATENT">;
    fileUrl?: string;
    fixtureFile?: string;
  }): Promise<{ importJobId: string; created: number; skipped: boolean }> {
    const sources = await ensureDefaultSources();
    const source = sources.find((s) => (options.fileUrl ? s.type === "OPEN_DATA" : s.type === "MOCK"));

    const job = await prisma.inpiImportJob.create({
      data: {
        sourceId: source?.id ?? null,
        sourceType: options.fileUrl ? "OPEN_DATA" : "MOCK",
        entityType: options.entityType,
        status: "RUNNING",
        fileUrl: options.fileUrl ?? null,
        fileName: options.fixtureFile ?? options.fileUrl?.split("/").pop() ?? null,
        startedAt: new Date(),
      },
    });

    try {
      let buffer: Buffer;
      let fileName: string;
      if (options.fileUrl) {
        buffer = await downloadPublicFile(options.fileUrl);
        fileName = options.fileUrl.split("/").pop() ?? "arquivo.csv";
      } else if (options.fixtureFile) {
        buffer = await fs.readFile(path.join(FIXTURES_DIR, options.fixtureFile));
        fileName = options.fixtureFile;
      } else {
        throw new Error("Informe fileUrl ou fixtureFile.");
      }

      // Checksum: nunca importar o mesmo arquivo duas vezes.
      const checksum = checksumOf(buffer);
      const existingFile = await prisma.inpiRawFile.findUnique({ where: { checksum } });
      if (existingFile) {
        await prisma.inpiImportJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            checksum,
            finishedAt: new Date(),
            errorMessage: null,
            metadata: { skipped: true, reason: "Arquivo já importado (checksum idêntico)." },
          },
        });
        await logSync({
          jobId: job.id,
          level: "INFO",
          message: `Importação ignorada: checksum ${checksum.slice(0, 12)} já existente.`,
        });
        return { importJobId: job.id, created: 0, skipped: true };
      }

      const saved = await saveInpiRawFile({
        buffer,
        fileName,
        sourceType: options.fileUrl ? "OPEN_DATA" : "MOCK",
      });

      const rawFile = await prisma.inpiRawFile.create({
        data: {
          importJobId: job.id,
          sourceType: options.fileUrl ? "OPEN_DATA" : "MOCK",
          entityType: options.entityType,
          originalUrl: options.fileUrl ?? null,
          fileName,
          filePath: saved.filePath,
          mimeType: "text/csv",
          checksum: saved.checksum,
          sizeBytes: saved.sizeBytes,
        },
      });

      const { rows, errors } = parseCsv(buffer);
      for (const err of errors) {
        await logSync({ jobId: job.id, level: "WARN", message: `CSV: ${err}` });
      }

      let created = 0;
      for (const row of rows) {
        const externalId =
          row.numero_processo ?? row.processo ?? row.process_number ?? null;
        await prisma.inpiRawRecord.create({
          data: {
            rawFileId: rawFile.id,
            entityType: options.entityType,
            externalId,
            rawData: row as never,
            status: "PENDING",
          },
        });
        created += 1;
      }

      await prisma.inpiImportJob.update({
        where: { id: job.id },
        data: { checksum: saved.checksum, totalRecords: created },
      });

      // Normalização staging → tabelas globais.
      const { normalizeRawRecordsForJob } = await import("../jobs/normalize-records-job");
      await normalizeRawRecordsForJob(job.id);

      const finished = await prisma.inpiImportJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", finishedAt: new Date() },
      });

      await logSync({
        jobId: job.id,
        level: "INFO",
        message: `Importação concluída: ${finished.processedRecords}/${finished.totalRecords} registros normalizados.`,
      });

      return { importJobId: job.id, created, skipped: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      await prisma.inpiImportJob.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessage: message.slice(0, 500), finishedAt: new Date() },
      });
      await logSync({ jobId: job.id, level: "ERROR", message });
      throw error;
    }
  }
}
