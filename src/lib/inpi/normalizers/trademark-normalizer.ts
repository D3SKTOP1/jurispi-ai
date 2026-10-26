import { prisma } from "@/lib/db";

import type { ParsedTrademarkRecord } from "../types";
import { normalizeProcessNumber, normalizeText, parseDateSafe } from "./text-normalizer";

/**
 * Normaliza um registro bruto de marca para a tabela global InpiTrademark.
 * Idempotente: upsert por processNumber; classes e requerentes são
 * substituídos a cada normalização (o rawData preserva a origem).
 */
export async function normalizeTrademarkRecord(
  record: ParsedTrademarkRecord,
  source: string
): Promise<string> {
  const processNumber = normalizeProcessNumber(record.processNumber);
  if (!processNumber || !record.brandName?.trim()) {
    throw new Error("Registro de marca sem processNumber ou brandName.");
  }

  const data = {
    brandName: record.brandName.trim(),
    normalizedName: normalizeText(record.brandName),
    holderName: record.holderName?.trim() || null,
    holderDocument: record.holderDocument?.trim() || null,
    presentation: record.presentation?.trim() || null,
    nature: record.nature?.trim() || null,
    status: record.status?.trim() || null,
    applicationDate: parseDateSafe(record.applicationDate),
    registrationDate: parseDateSafe(record.registrationDate),
    expirationDate: parseDateSafe(record.expirationDate),
    source,
    sourceUpdatedAt: new Date(),
    rawData: record as never,
  };

  const trademark = await prisma.inpiTrademark.upsert({
    where: { processNumber },
    create: { processNumber, ...data },
    update: data,
  });

  await prisma.inpiTrademarkClass.deleteMany({ where: { trademarkId: trademark.id } });
  if (record.niceClasses?.length) {
    await prisma.inpiTrademarkClass.createMany({
      data: record.niceClasses.map((c) => ({
        trademarkId: trademark.id,
        niceClass: String(c.niceClass).padStart(2, "0"),
        specification: c.specification ?? null,
      })),
    });
  }

  await prisma.inpiTrademarkApplicant.deleteMany({ where: { trademarkId: trademark.id } });
  if (record.applicants?.length) {
    await prisma.inpiTrademarkApplicant.createMany({
      data: record.applicants.map((a) => ({
        trademarkId: trademark.id,
        name: a.name,
        document: a.document ?? null,
        country: a.country ?? null,
      })),
    });
  }

  return trademark.id;
}

/** Converte uma linha de CSV de dados abertos em ParsedTrademarkRecord. */
export function trademarkRecordFromCsvRow(
  row: Record<string, string>
): ParsedTrademarkRecord | null {
  const processNumber = row.numero_processo ?? row.processo ?? row.process_number;
  const brandName = row.marca ?? row.nome_marca ?? row.brand_name;
  if (!processNumber || !brandName) return null;

  return {
    processNumber,
    brandName,
    holderName: row.titular ?? row.holder,
    holderDocument: row.documento_titular ?? row.cnpj_cpf,
    presentation: row.apresentacao ?? row.presentation,
    nature: row.natureza ?? row.nature,
    status: row.situacao ?? row.status,
    applicationDate: row.data_deposito ?? row.application_date,
    registrationDate: row.data_registro ?? row.registration_date,
    expirationDate: row.data_vigencia ?? row.expiration_date,
    niceClasses: (row.classes_nice ?? row.classe ?? "")
      .split(/[|,;]/)
      .map((c) => c.trim())
      .filter(Boolean)
      .map((niceClass) => ({ niceClass })),
    applicants: row.titular ? [{ name: row.titular, document: row.documento_titular }] : [],
  };
}
