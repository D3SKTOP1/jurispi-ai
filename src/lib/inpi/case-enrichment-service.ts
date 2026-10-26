import "server-only";

import { prisma } from "@/lib/db";

import { liveInpiSearchService } from "./search/live-search-service";
import { normalizeProcessNumber } from "./normalizers/text-normalizer";

export interface EnrichResult {
  enriched: boolean;
  origin?: "live" | "local";
  degraded?: boolean;
  message: string;
}

/**
 * Enriquece um caso do escritório com o registro oficial do INPI, ligados
 * pelo número do processo. Puxa o dado AO VIVO (fallback local) e atualiza
 * o subregistro (TrademarkCase/PatentCase) — mantém o caso em dia com o INPI
 * sem drift, e sem exigir espelho nacional.
 */
export async function enrichCaseFromInpi(
  caseId: string,
  organizationId: string
): Promise<EnrichResult> {
  const kase = await prisma.industrialPropertyCase.findFirst({
    where: { id: caseId, organizationId },
    include: { trademark: true, patent: true },
  });
  if (!kase) return { enriched: false, message: "Caso não encontrado." };
  if (!kase.processNumber) {
    return { enriched: false, message: "O caso não tem número de processo para casar com o INPI." };
  }

  const processNumber = normalizeProcessNumber(kase.processNumber);

  if (kase.type === "TRADEMARK") {
    const { results, origin, degraded } = await liveInpiSearchService.searchTrademarks(
      { processNumber },
      { live: true }
    );
    const tm = results[0];
    if (!tm) {
      return { enriched: false, origin, degraded, message: "Processo não encontrado no INPI." };
    }
    await prisma.$transaction([
      prisma.trademarkCase.upsert({
        where: { caseId: kase.id },
        update: {
          brandName: tm.brandName || kase.trademark?.brandName || kase.title,
          niceClasses: tm.niceClasses,
          presentationType: tm.presentation ?? kase.trademark?.presentationType ?? null,
          nature: tm.nature ?? kase.trademark?.nature ?? null,
          holderName: tm.holderName ?? kase.trademark?.holderName ?? null,
          applicationDate: tm.applicationDate ?? kase.trademark?.applicationDate ?? null,
          currentStatus: tm.status ?? kase.trademark?.currentStatus ?? null,
        },
        create: {
          caseId: kase.id,
          brandName: tm.brandName || kase.title,
          niceClasses: tm.niceClasses,
          presentationType: tm.presentation ?? null,
          nature: tm.nature ?? null,
          holderName: tm.holderName ?? null,
          applicationDate: tm.applicationDate ?? null,
          currentStatus: tm.status ?? null,
        },
      }),
      prisma.industrialPropertyCase.update({
        where: { id: kase.id },
        data: { processNumber },
      }),
    ]);
    return {
      enriched: true,
      origin,
      degraded,
      message: `Caso sincronizado com o INPI (${tm.status ?? "situação não informada"}).`,
    };
  }

  if (kase.type === "PATENT") {
    const { results, origin, degraded } = await liveInpiSearchService.searchPatents(
      { processNumber },
      { live: true }
    );
    const pt = results[0];
    if (!pt) {
      return { enriched: false, origin, degraded, message: "Processo não encontrado no INPI." };
    }
    await prisma.$transaction([
      prisma.patentCase.upsert({
        where: { caseId: kase.id },
        update: {
          title: pt.title || kase.patent?.title || kase.title,
          abstract: pt.abstractText ?? kase.patent?.abstract ?? null,
          ipcClasses: pt.ipcClasses,
          applicants: pt.applicants,
          inventors: pt.inventors,
          filingDate: pt.applicationDate ?? kase.patent?.filingDate ?? null,
          publicationDate: pt.publicationDate ?? kase.patent?.publicationDate ?? null,
          grantDate: pt.grantDate ?? kase.patent?.grantDate ?? null,
          currentStatus: pt.status ?? kase.patent?.currentStatus ?? null,
        },
        create: {
          caseId: kase.id,
          title: pt.title || kase.title,
          abstract: pt.abstractText ?? null,
          ipcClasses: pt.ipcClasses,
          applicants: pt.applicants,
          inventors: pt.inventors,
          filingDate: pt.applicationDate ?? null,
          publicationDate: pt.publicationDate ?? null,
          grantDate: pt.grantDate ?? null,
          currentStatus: pt.status ?? null,
        },
      }),
      prisma.industrialPropertyCase.update({
        where: { id: kase.id },
        data: { processNumber },
      }),
    ]);
    return {
      enriched: true,
      origin,
      degraded,
      message: `Caso sincronizado com o INPI (${pt.status ?? "situação não informada"}).`,
    };
  }

  return { enriched: false, message: "Enriquecimento disponível para marcas e patentes." };
}
