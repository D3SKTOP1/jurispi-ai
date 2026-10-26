import "server-only";

import { prisma } from "@/lib/db";

import { PePiLiveProvider } from "../providers/pepi-live-provider";
import { normalizeProcessNumber } from "../normalizers/text-normalizer";
import type { PatentSearchResult, TrademarkSearchResult } from "../types";

const provider = new PePiLiveProvider();

export interface ImportItem {
  processNumber: string;
  type: "TRADEMARK" | "PATENT";
  title: string;
  niceClasses?: string[];
  holderName?: string | null;
}

export interface ImportReport {
  imported: number;
  existed: number;
  failed: number;
  errors: string[];
}

/**
 * Importação de carteira por titular — a partir da fonte oficial (INPI),
 * não copiando de outra plataforma. Reconstrói casos + monitoramento com o
 * número do processo; o enriquecimento (dados completos) roda depois via
 * "Sincronizar com INPI" ou pelo cron de monitoramento.
 */
export class PortfolioImportService {
  /** Passo 1: titulares que casam com o CNPJ/nome + patentes por depositante. */
  async search(query: string): Promise<{
    holders: Array<{ pos: number; name: string }>;
    patents: PatentSearchResult[];
  }> {
    const [holders, patents] = await Promise.all([
      provider.searchTrademarkHolders(query).catch(() => []),
      provider.searchPatent({ applicant: query, limit: 100 }).catch(() => []),
    ]);
    return { holders, patents };
  }

  /** Passo 2: marcas de um titular específico. */
  async listHolderTrademarks(query: string, pos: number): Promise<TrademarkSearchResult[]> {
    return provider.listHolderTrademarks(query, pos);
  }

  /**
   * Importa os itens selecionados: cria o caso (com subregistro mínimo) e o
   * monitoramento, deduplicando por número de processo já existente na org.
   */
  async import(
    organizationId: string,
    clientId: string | null,
    items: ImportItem[]
  ): Promise<ImportReport> {
    const report: ImportReport = { imported: 0, existed: 0, failed: 0, errors: [] };

    for (const item of items) {
      const processNumber = normalizeProcessNumber(item.processNumber);
      if (!processNumber) {
        report.failed += 1;
        continue;
      }
      try {
        const existing = await prisma.industrialPropertyCase.findFirst({
          where: { organizationId, processNumber },
          select: { id: true },
        });
        if (existing) {
          report.existed += 1;
          await this.ensureMonitored(organizationId, existing.id, clientId, item);
          continue;
        }

        const title = item.title?.trim() || `${item.type === "TRADEMARK" ? "Marca" : "Patente"} ${processNumber}`;
        const created = await prisma.industrialPropertyCase.create({
          data: {
            organizationId,
            clientId: clientId ?? null,
            type: item.type,
            title,
            processNumber,
            status: "EM_ANDAMENTO",
            ...(item.type === "TRADEMARK"
              ? {
                  trademark: {
                    create: {
                      brandName: item.title?.trim() || title,
                      niceClasses: item.niceClasses ?? [],
                      holderName: item.holderName ?? null,
                    },
                  },
                }
              : {
                  patent: {
                    create: {
                      title: item.title?.trim() || title,
                      ipcClasses: [],
                      applicants: item.holderName ? [item.holderName] : [],
                      inventors: [],
                    },
                  },
                }),
          },
        });

        await this.ensureMonitored(organizationId, created.id, clientId, item);
        report.imported += 1;
      } catch (error) {
        report.failed += 1;
        report.errors.push(
          `${item.processNumber}: ${error instanceof Error ? error.message.slice(0, 120) : "erro"}`
        );
      }
    }

    return report;
  }

  private async ensureMonitored(
    organizationId: string,
    caseId: string,
    clientId: string | null,
    item: ImportItem
  ): Promise<void> {
    const processNumber = normalizeProcessNumber(item.processNumber);
    await prisma.monitoredProcess.upsert({
      where: { organizationId_processNumber: { organizationId, processNumber } },
      create: {
        organizationId,
        processNumber,
        type: item.type,
        title: item.title?.trim() || null,
        clientId: clientId ?? null,
        caseId,
        isActive: true,
      },
      update: { isActive: true, caseId },
    });
  }
}

export const portfolioImportService = new PortfolioImportService();
