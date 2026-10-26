import { prisma } from "@/lib/db";

import type { ParsedRpiDispatchRecord } from "../types";
import { normalizeProcessNumber } from "./text-normalizer";

/**
 * Normaliza despachos parseados da RPI:
 * 1. grava RpiDispatch na seção correspondente (com deduplicação);
 * 2. replica em InpiTrademarkDispatch/InpiPatentDispatch, vinculando ao
 *    processo global quando ele existir na base.
 *
 * Deduplicação: processNumber + rpiNumber + dispatchCode + dispatchText.
 */
export async function normalizeRpiDispatch(input: {
  record: ParsedRpiDispatchRecord;
  rpiSectionId: string;
  rpiNumber: string;
  rpiDate: Date | null;
  sectionCode: string;
  sourceFileId?: string | null;
}): Promise<{ created: boolean }> {
  const processNumber = normalizeProcessNumber(input.record.processNumber);
  const dispatchCode = input.record.dispatchCode ?? null;
  const dispatchText = input.record.dispatchText.trim();

  const existing = await prisma.rpiDispatch.findFirst({
    where: {
      processNumber,
      dispatchCode,
      dispatchText,
      rpiSection: { rpiIssue: { number: input.rpiNumber } },
    },
    select: { id: true },
  });
  if (existing) return { created: false };

  await prisma.rpiDispatch.create({
    data: {
      rpiSectionId: input.rpiSectionId,
      processNumber,
      dispatchCode,
      dispatchText,
      holderName: input.record.holderName ?? null,
      title: input.record.title ?? null,
      rawData: input.record as never,
    },
  });

  // Replica no histórico do processo global (marca ou patente).
  if (input.record.entityKind === "PATENT") {
    const patent = await prisma.inpiPatent.findUnique({
      where: { processNumber },
      select: { id: true },
    });
    const dup = await prisma.inpiPatentDispatch.findFirst({
      where: { processNumber, rpiNumber: input.rpiNumber, dispatchCode, dispatchText },
      select: { id: true },
    });
    if (!dup) {
      await prisma.inpiPatentDispatch.create({
        data: {
          patentId: patent?.id ?? null,
          processNumber,
          rpiNumber: input.rpiNumber,
          rpiDate: input.rpiDate,
          dispatchCode,
          dispatchText,
          section: input.sectionCode,
          sourceFileId: input.sourceFileId ?? null,
        },
      });
    }
  } else {
    const trademark = await prisma.inpiTrademark.findUnique({
      where: { processNumber },
      select: { id: true },
    });
    const dup = await prisma.inpiTrademarkDispatch.findFirst({
      where: { processNumber, rpiNumber: input.rpiNumber, dispatchCode, dispatchText },
      select: { id: true },
    });
    if (!dup) {
      await prisma.inpiTrademarkDispatch.create({
        data: {
          trademarkId: trademark?.id ?? null,
          processNumber,
          rpiNumber: input.rpiNumber,
          rpiDate: input.rpiDate,
          dispatchCode,
          dispatchText,
          section: input.sectionCode,
          sourceFileId: input.sourceFileId ?? null,
        },
      });
    }
  }

  return { created: true };
}
