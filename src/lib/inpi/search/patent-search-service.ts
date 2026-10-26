import { prisma } from "@/lib/db";

import type { PatentSearchParams, PatentSearchResult } from "../types";
import { normalizeProcessNumber, normalizeText } from "../normalizers/text-normalizer";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface RankedRow {
  id: string;
  rank: number;
}

/**
 * PatentSearchService — busca na base GLOBAL de patentes importadas.
 * Busca textual via PostgreSQL full-text search (dicionário português);
 * busca semântica com pgvector fica preparada (preparePatentSemanticSearch).
 */
export class PatentSearchService {
  private async hydrate(
    ids: string[],
    ranks?: Map<string, number>
  ): Promise<PatentSearchResult[]> {
    if (ids.length === 0) return [];
    const rows = await prisma.inpiPatent.findMany({
      where: { id: { in: ids } },
      include: { ipcClasses: true, applicants: true, inventors: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        id: r.id,
        processNumber: r.processNumber,
        title: r.title,
        abstractText: r.abstractText,
        status: r.status,
        applicationDate: r.applicationDate,
        publicationDate: r.publicationDate,
        grantDate: r.grantDate,
        ipcClasses: [...new Set(r.ipcClasses.map((c) => c.ipcCode))],
        applicants: r.applicants.map((a) => a.name),
        inventors: r.inventors.map((i) => i.name),
        rank: ranks?.get(r.id),
        source: r.source,
        sourceUpdatedAt: r.sourceUpdatedAt,
      }));
  }

  async searchPatentByProcessNumber(processNumber: string): Promise<PatentSearchResult | null> {
    const normalized = normalizeProcessNumber(processNumber);
    if (!normalized) return null;
    const row = await prisma.inpiPatent.findUnique({
      where: { processNumber: normalized },
      select: { id: true },
    });
    if (!row) return null;
    const [result] = await this.hydrate([row.id]);
    return result ?? null;
  }

  async searchPatentByTitle(title: string): Promise<PatentSearchResult[]> {
    const normalized = normalizeText(title);
    if (!normalized) return [];
    const rows = await prisma.inpiPatent.findMany({
      where: {
        OR: [
          { normalizedTitle: { contains: normalized } },
          { title: { contains: title.trim(), mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: DEFAULT_LIMIT,
    });
    return this.hydrate(rows.map((r) => r.id));
  }

  async searchPatentByApplicant(applicant: string): Promise<PatentSearchResult[]> {
    const rows = await prisma.inpiPatent.findMany({
      where: { applicants: { some: { name: { contains: applicant.trim(), mode: "insensitive" } } } },
      select: { id: true },
      take: DEFAULT_LIMIT,
    });
    return this.hydrate(rows.map((r) => r.id));
  }

  async searchPatentByInventor(inventor: string): Promise<PatentSearchResult[]> {
    const rows = await prisma.inpiPatent.findMany({
      where: { inventors: { some: { name: { contains: inventor.trim(), mode: "insensitive" } } } },
      select: { id: true },
      take: DEFAULT_LIMIT,
    });
    return this.hydrate(rows.map((r) => r.id));
  }

  async searchPatentByIpc(ipcCode: string): Promise<PatentSearchResult[]> {
    const rows = await prisma.inpiPatent.findMany({
      where: { ipcClasses: { some: { ipcCode: { startsWith: ipcCode.trim(), mode: "insensitive" } } } },
      select: { id: true },
      take: MAX_LIMIT,
    });
    return this.hydrate(rows.map((r) => r.id));
  }

  /** Busca textual full-text (título + resumo, dicionário português). */
  async searchPatentText(query: string, limit = DEFAULT_LIMIT): Promise<PatentSearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    const rows = await prisma.$queryRaw<RankedRow[]>`
      SELECT id,
             ts_rank(
               to_tsvector('portuguese', coalesce("title", '') || ' ' || coalesce("abstractText", '')),
               plainto_tsquery('portuguese', ${q})
             ) AS rank
      FROM "InpiPatent"
      WHERE to_tsvector('portuguese', coalesce("title", '') || ' ' || coalesce("abstractText", ''))
            @@ plainto_tsquery('portuguese', ${q})
      ORDER BY rank DESC
      LIMIT ${Math.min(limit, MAX_LIMIT)}
    `;
    return this.hydrate(
      rows.map((r) => r.id),
      new Map(rows.map((r) => [r.id, Number(r.rank)]))
    );
  }

  /**
   * Busca semântica futura: a estrutura está pronta — os resumos podem ser
   * vetorizados pelo job generateInpiEmbeddings e consultados via pgvector.
   * No MVP, retorna a busca textual como fallback documentado.
   */
  async preparePatentSemanticSearch(query: string): Promise<{
    strategy: "fulltext-fallback";
    note: string;
    results: PatentSearchResult[];
  }> {
    return {
      strategy: "fulltext-fallback",
      note:
        "Busca semântica com pgvector preparada (job generateInpiEmbeddings). " +
        "No MVP os resultados vêm do full-text search em português.",
      results: await this.searchPatentText(query),
    };
  }

  /** Busca combinada usada pela tela unificada e pela API. */
  async search(params: PatentSearchParams): Promise<PatentSearchResult[]> {
    if (params.processNumber) {
      const one = await this.searchPatentByProcessNumber(params.processNumber);
      return one ? [one] : [];
    }

    let results: PatentSearchResult[];
    if (params.query) {
      results = await this.searchPatentText(params.query, params.limit);
      if (results.length === 0) results = await this.searchPatentByTitle(params.query);
    } else if (params.applicant) {
      results = await this.searchPatentByApplicant(params.applicant);
    } else if (params.inventor) {
      results = await this.searchPatentByInventor(params.inventor);
    } else if (params.ipc) {
      results = await this.searchPatentByIpc(params.ipc);
    } else {
      const rows = await prisma.inpiPatent.findMany({
        select: { id: true },
        orderBy: { updatedAt: "desc" },
        take: Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
        skip: params.offset ?? 0,
      });
      results = await this.hydrate(rows.map((r) => r.id));
    }

    if (params.ipc && params.query) {
      const ipc = params.ipc.trim().toUpperCase();
      results = results.filter((r) => r.ipcClasses.some((c) => c.toUpperCase().startsWith(ipc)));
    }
    if (params.status) {
      const st = normalizeText(params.status);
      results = results.filter((r) => normalizeText(r.status ?? "").includes(st));
    }
    if (params.applicant && params.query) {
      const a = normalizeText(params.applicant);
      results = results.filter((r) => r.applicants.some((n) => normalizeText(n).includes(a)));
    }

    return results.slice(0, Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  }

  async getDispatches(processNumber: string) {
    return prisma.inpiPatentDispatch.findMany({
      where: { processNumber: normalizeProcessNumber(processNumber) },
      orderBy: [{ rpiDate: "desc" }, { createdAt: "desc" }],
    });
  }
}

export const patentSearchService = new PatentSearchService();
