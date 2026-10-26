import "server-only";

import { prisma } from "@/lib/db";

import { normalizeProcessNumber } from "../normalizers/text-normalizer";
import type { PatentSearchResult, TrademarkSearchResult } from "../types";

/**
 * Cache "cresce-com-o-uso": em vez de espelhar o Brasil inteiro, cada
 * resultado que a busca ao vivo traz do INPI é gravado localmente. Assim o
 * corpus de similaridade/risco (pg_trgm) cresce em torno do que o escritório
 * realmente pesquisa — sem ingestão pesada.
 *
 * É resiliente e não bloqueante em espírito: qualquer falha é engolida (o
 * cache nunca pode derrubar uma busca). Limita o volume por chamada.
 */

const MAX_CACHE = 30;

export async function cacheTrademarks(results: TrademarkSearchResult[]): Promise<void> {
  for (const r of results.slice(0, MAX_CACHE)) {
    if (!r.brandName || !r.normalizedName) continue;
    const processNumber = normalizeProcessNumber(r.processNumber);
    if (!processNumber) continue;
    try {
      await prisma.inpiTrademark.upsert({
        where: { processNumber },
        update: {
          brandName: r.brandName,
          normalizedName: r.normalizedName,
          holderName: r.holderName,
          presentation: r.presentation,
          nature: r.nature,
          status: r.status,
          applicationDate: r.applicationDate,
          registrationDate: r.registrationDate,
          source: r.source,
          sourceUpdatedAt: r.sourceUpdatedAt,
        },
        create: {
          processNumber,
          brandName: r.brandName,
          normalizedName: r.normalizedName,
          holderName: r.holderName,
          presentation: r.presentation,
          nature: r.nature,
          status: r.status,
          applicationDate: r.applicationDate,
          registrationDate: r.registrationDate,
          source: r.source,
          sourceUpdatedAt: r.sourceUpdatedAt,
          classes: {
            create: [...new Set(r.niceClasses)].map((niceClass) => ({ niceClass })),
          },
        },
      });
    } catch (error) {
      console.error(`[corpus-cache] marca ${processNumber} não cacheada:`, error);
    }
  }
}

export async function cachePatents(results: PatentSearchResult[]): Promise<void> {
  for (const r of results.slice(0, MAX_CACHE)) {
    if (!r.title) continue;
    const processNumber = normalizeProcessNumber(r.processNumber);
    if (!processNumber) continue;
    try {
      await prisma.inpiPatent.upsert({
        where: { processNumber },
        update: {
          title: r.title,
          abstractText: r.abstractText,
          status: r.status,
          applicationDate: r.applicationDate,
          publicationDate: r.publicationDate,
          grantDate: r.grantDate,
          source: r.source,
          sourceUpdatedAt: r.sourceUpdatedAt,
        },
        create: {
          processNumber,
          title: r.title,
          abstractText: r.abstractText,
          status: r.status,
          applicationDate: r.applicationDate,
          publicationDate: r.publicationDate,
          grantDate: r.grantDate,
          source: r.source,
          sourceUpdatedAt: r.sourceUpdatedAt,
          ipcClasses: {
            create: [...new Set(r.ipcClasses)].map((ipcCode) => ({ ipcCode })),
          },
        },
      });
    } catch (error) {
      console.error(`[corpus-cache] patente ${processNumber} não cacheada:`, error);
    }
  }
}
