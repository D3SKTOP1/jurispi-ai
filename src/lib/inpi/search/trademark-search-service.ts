import { prisma } from "@/lib/db";

import {
  INPI_DISCLAIMER,
  type TrademarkRiskInput,
  type TrademarkRiskResult,
  type TrademarkSearchParams,
  type TrademarkSearchResult,
} from "../types";
import {
  normalizeProcessNumber,
  normalizeText,
  radicalOf,
} from "../normalizers/text-normalizer";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface SimilarRow {
  id: string;
  sim: number;
}

/**
 * TrademarkSearchService — busca na base GLOBAL de marcas importadas do INPI.
 *
 * Estratégia por camada (sem IA):
 * - dados estruturados → Prisma/SQL normal;
 * - nomes parecidos → pg_trgm sobre a coluna normalizedName
 *   (já minúscula e sem acentos, gravada na normalização);
 * - radical → prefixo do nome normalizado.
 */
export class TrademarkSearchService {
  private async hydrate(
    ids: string[],
    similarities?: Map<string, number>
  ): Promise<TrademarkSearchResult[]> {
    if (ids.length === 0) return [];
    const rows = await prisma.inpiTrademark.findMany({
      where: { id: { in: ids } },
      include: { classes: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        id: r.id,
        processNumber: r.processNumber,
        brandName: r.brandName,
        normalizedName: r.normalizedName,
        holderName: r.holderName,
        presentation: r.presentation,
        nature: r.nature,
        status: r.status,
        applicationDate: r.applicationDate,
        registrationDate: r.registrationDate,
        // A RPI pode listar a mesma classe mais de uma vez (especificações
        // distintas) — para exibição e filtros basta o código único.
        niceClasses: [...new Set(r.classes.map((c) => c.niceClass))],
        similarity: similarities?.get(r.id),
        source: r.source,
        sourceUpdatedAt: r.sourceUpdatedAt,
      }));
  }

  /** 1-3. Busca exata pelo nome (normalizado, sem acentos). */
  async searchExactBrandName(name: string): Promise<TrademarkSearchResult[]> {
    const normalized = normalizeText(name);
    if (!normalized) return [];
    const rows = await prisma.inpiTrademark.findMany({
      where: { normalizedName: normalized },
      select: { id: true },
      take: DEFAULT_LIMIT,
    });
    return this.hydrate(rows.map((r) => r.id));
  }

  /** 4. Busca por similaridade trigram (pg_trgm). */
  async searchSimilarBrandNames(
    name: string,
    options?: { threshold?: number; limit?: number }
  ): Promise<TrademarkSearchResult[]> {
    const normalized = normalizeText(name);
    if (!normalized) return [];
    const threshold = Math.min(Math.max(options?.threshold ?? 0.3, 0.05), 1);
    const limit = Math.min(options?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const rows = await prisma.$queryRaw<SimilarRow[]>`
      SELECT id, similarity("normalizedName", ${normalized}) AS sim
      FROM "InpiTrademark"
      WHERE similarity("normalizedName", ${normalized}) >= ${threshold}
         OR "normalizedName" LIKE ${"%" + normalized + "%"}
      ORDER BY similarity("normalizedName", ${normalized}) DESC
      LIMIT ${limit}
    `;

    const similarities = new Map(rows.map((r) => [r.id, Number(r.sim)]));
    return this.hydrate(
      rows.map((r) => r.id),
      similarities
    );
  }

  /** 5. Busca por radical (prefixo do nome normalizado). */
  async searchByRadical(name: string, limit = DEFAULT_LIMIT): Promise<TrademarkSearchResult[]> {
    const radical = radicalOf(name);
    if (!radical) return [];
    const rows = await prisma.inpiTrademark.findMany({
      where: { normalizedName: { startsWith: radical } },
      select: { id: true },
      take: Math.min(limit, MAX_LIMIT),
    });
    return this.hydrate(rows.map((r) => r.id));
  }

  /** 6. Busca por classe Nice. */
  async searchTrademarkByClass(niceClass: string): Promise<TrademarkSearchResult[]> {
    const cls = niceClass.trim().padStart(2, "0");
    const rows = await prisma.inpiTrademark.findMany({
      where: { classes: { some: { niceClass: cls } } },
      select: { id: true },
      take: MAX_LIMIT,
      orderBy: { brandName: "asc" },
    });
    return this.hydrate(rows.map((r) => r.id));
  }

  /** 7. Busca por titular (trigram + contains). */
  async searchTrademarkByHolder(holderName: string): Promise<TrademarkSearchResult[]> {
    const normalized = normalizeText(holderName);
    if (!normalized) return [];
    const rows = await prisma.$queryRaw<SimilarRow[]>`
      SELECT id, similarity(coalesce("holderName", ''), ${holderName}) AS sim
      FROM "InpiTrademark"
      WHERE "holderName" ILIKE ${"%" + holderName.trim() + "%"}
         OR similarity(coalesce("holderName", ''), ${holderName}) >= 0.35
      ORDER BY sim DESC
      LIMIT ${DEFAULT_LIMIT}
    `;
    return this.hydrate(
      rows.map((r) => r.id),
      new Map(rows.map((r) => [r.id, Number(r.sim)]))
    );
  }

  /** 8. Busca por número do processo. */
  async searchTrademarkByProcessNumber(
    processNumber: string
  ): Promise<TrademarkSearchResult | null> {
    const normalized = normalizeProcessNumber(processNumber);
    if (!normalized) return null;
    const row = await prisma.inpiTrademark.findUnique({
      where: { processNumber: normalized },
      select: { id: true },
    });
    if (!row) return null;
    const [result] = await this.hydrate([row.id]);
    return result ?? null;
  }

  /** Busca combinada usada pela tela unificada e pela API. */
  async search(params: TrademarkSearchParams): Promise<TrademarkSearchResult[]> {
    if (params.processNumber) {
      const one = await this.searchTrademarkByProcessNumber(params.processNumber);
      return one ? [one] : [];
    }

    let results: TrademarkSearchResult[];
    if (params.query) {
      if (params.mode === "exact") results = await this.searchExactBrandName(params.query);
      else if (params.mode === "prefix") results = await this.searchByRadical(params.query);
      else
        results = await this.searchSimilarBrandNames(params.query, {
          threshold: params.threshold,
          limit: params.limit,
        });
    } else if (params.holder) {
      results = await this.searchTrademarkByHolder(params.holder);
    } else if (params.niceClass) {
      results = await this.searchTrademarkByClass(params.niceClass);
    } else {
      const rows = await prisma.inpiTrademark.findMany({
        select: { id: true },
        orderBy: { updatedAt: "desc" },
        take: Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
        skip: params.offset ?? 0,
      });
      results = await this.hydrate(rows.map((r) => r.id));
    }

    // Filtros pós-busca (classe/status/titular combinados com query).
    if (params.niceClass && params.query) {
      const cls = params.niceClass.trim().padStart(2, "0");
      results = results.filter((r) => r.niceClasses.includes(cls));
    }
    if (params.status) {
      const st = normalizeText(params.status);
      results = results.filter((r) => normalizeText(r.status ?? "").includes(st));
    }
    if (params.holder && params.query) {
      const h = normalizeText(params.holder);
      results = results.filter((r) => normalizeText(r.holderName ?? "").includes(h));
    }

    return results.slice(0, Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  }

  /** Despachos de um processo de marca (RPI + dados abertos). */
  async getDispatches(processNumber: string) {
    return prisma.inpiTrademarkDispatch.findMany({
      where: { processNumber: normalizeProcessNumber(processNumber) },
      orderBy: [{ rpiDate: "desc" }, { createdAt: "desc" }],
    });
  }

  /**
   * 10. Análise preliminar de risco de colisão — heurística determinística
   * sobre a base global. A IA usa este resultado; ela não o inventa.
   */
  async analyzeTrademarkRisk(input: TrademarkRiskInput): Promise<TrademarkRiskResult> {
    const normalized = normalizeText(input.brandName);
    const classes = input.niceClasses.map((c) => c.trim().padStart(2, "0"));
    const reasons: string[] = [];
    let score = 0;

    const similar = await this.searchSimilarBrandNames(input.brandName, {
      threshold: 0.3,
      limit: input.limit ?? 15,
    });

    if (similar.length === 0) {
      return {
        riskLevel: "UNKNOWN",
        score: 0,
        reasons: [
          "Nenhuma marca semelhante encontrada na base importada. A cobertura da base pode ser parcial — recomenda-se busca oficial no INPI.",
        ],
        similarMarks: [],
        disclaimer: INPI_DISCLAIMER,
      };
    }

    const isActive = (status: string | null) => {
      const s = normalizeText(status ?? "");
      if (!s) return true; // status desconhecido: trata como potencialmente ativo
      return !/(arquiv|extin|indefer|cancel|caduc|nulidade procedente)/.test(s);
    };

    for (const mark of similar) {
      const identical = mark.normalizedName === normalized;
      const verySimilar = (mark.similarity ?? 0) >= 0.65;
      const sameClass = mark.niceClasses.some((c) => classes.includes(c));
      const active = isActive(mark.status);

      if (identical && sameClass && active) {
        score += 55;
        reasons.push(
          `Marca idêntica "${mark.brandName}" (processo ${mark.processNumber}) ativa na mesma classe.`
        );
      } else if (identical && active) {
        score += 30;
        reasons.push(
          `Marca idêntica "${mark.brandName}" (processo ${mark.processNumber}) ativa em classe distinta — avaliar afinidade mercadológica.`
        );
      } else if (verySimilar && sameClass && active) {
        score += 35;
        reasons.push(
          `Marca muito semelhante "${mark.brandName}" (similaridade ${((mark.similarity ?? 0) * 100).toFixed(0)}%, processo ${mark.processNumber}) ativa na mesma classe.`
        );
      } else if (verySimilar && active) {
        score += 12;
        reasons.push(
          `Marca muito semelhante "${mark.brandName}" (processo ${mark.processNumber}) ativa em classe distinta.`
        );
      } else if (sameClass && active && (mark.similarity ?? 0) >= 0.4) {
        score += 8;
        reasons.push(
          `Marca semelhante "${mark.brandName}" (processo ${mark.processNumber}) na mesma classe.`
        );
      } else if (!active) {
        reasons.push(
          `Marca "${mark.brandName}" (processo ${mark.processNumber}) encontrada, porém com status inativo/arquivado — risco reduzido.`
        );
      }
    }

    // Despachos relevantes nas marcas mais próximas (oposição/indeferimento indicam zona contenciosa).
    const topProcessNumbers = similar.slice(0, 5).map((m) => m.processNumber);
    const dispatches = await prisma.inpiTrademarkDispatch.findMany({
      where: { processNumber: { in: topProcessNumbers } },
      take: 50,
      select: { processNumber: true, dispatchText: true },
    });
    const contentious = dispatches.filter((d) =>
      /(oposi[cç][aã]o|indeferimento|nulidade|caducidade)/i.test(d.dispatchText)
    );
    if (contentious.length > 0) {
      score += 5;
      reasons.push(
        `Foram identificados ${contentious.length} despacho(s) contencioso(s) (oposição/indeferimento/nulidade) em processos semelhantes.`
      );
    }

    score = Math.min(score, 100);
    const riskLevel: TrademarkRiskResult["riskLevel"] =
      score >= 55 ? "HIGH" : score >= 25 ? "MEDIUM" : score > 0 ? "LOW" : "LOW";

    if (reasons.length === 0) {
      reasons.push("Marcas semelhantes existem, mas sem sobreposição relevante de classe ou status ativo.");
    }

    return {
      riskLevel,
      score,
      reasons,
      similarMarks: similar,
      disclaimer: INPI_DISCLAIMER,
    };
  }
}

export const trademarkSearchService = new TrademarkSearchService();
