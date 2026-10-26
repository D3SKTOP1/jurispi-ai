import { prisma } from "@/lib/db";

import type { ParsedPatentRecord } from "../types";
import { normalizeProcessNumber, normalizeText, parseDateSafe } from "./text-normalizer";

/**
 * Normaliza um registro bruto de patente para a tabela global InpiPatent.
 * Idempotente: upsert por processNumber.
 */
export async function normalizePatentRecord(
  record: ParsedPatentRecord,
  source: string
): Promise<string> {
  const processNumber = normalizeProcessNumber(record.processNumber);
  if (!processNumber || !record.title?.trim()) {
    throw new Error("Registro de patente sem processNumber ou título.");
  }

  const data = {
    title: record.title.trim(),
    normalizedTitle: normalizeText(record.title),
    abstractText: record.abstractText?.trim() || null,
    status: record.status?.trim() || null,
    applicationDate: parseDateSafe(record.applicationDate),
    publicationDate: parseDateSafe(record.publicationDate),
    grantDate: parseDateSafe(record.grantDate),
    expirationDate: parseDateSafe(record.expirationDate),
    source,
    sourceUpdatedAt: new Date(),
    rawData: record as never,
  };

  const patent = await prisma.inpiPatent.upsert({
    where: { processNumber },
    create: { processNumber, ...data },
    update: data,
  });

  await prisma.inpiPatentIpcClass.deleteMany({ where: { patentId: patent.id } });
  if (record.ipcClasses?.length) {
    await prisma.inpiPatentIpcClass.createMany({
      data: record.ipcClasses.map((ipcCode) => ({ patentId: patent.id, ipcCode: ipcCode.trim() })),
    });
  }

  await prisma.inpiPatentApplicant.deleteMany({ where: { patentId: patent.id } });
  if (record.applicants?.length) {
    await prisma.inpiPatentApplicant.createMany({
      data: record.applicants.map((a) => ({
        patentId: patent.id,
        name: a.name,
        document: a.document ?? null,
        country: a.country ?? null,
      })),
    });
  }

  await prisma.inpiPatentInventor.deleteMany({ where: { patentId: patent.id } });
  if (record.inventors?.length) {
    await prisma.inpiPatentInventor.createMany({
      data: record.inventors.map((i) => ({
        patentId: patent.id,
        name: i.name,
        country: i.country ?? null,
      })),
    });
  }

  return patent.id;
}

/** Converte uma linha de CSV de dados abertos em ParsedPatentRecord. */
export function patentRecordFromCsvRow(row: Record<string, string>): ParsedPatentRecord | null {
  const processNumber = row.numero_processo ?? row.processo ?? row.process_number;
  const title = row.titulo ?? row.title;
  if (!processNumber || !title) return null;

  const splitList = (v?: string) =>
    (v ?? "")
      .split(/[|;]/)
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    processNumber,
    title,
    abstractText: row.resumo ?? row.abstract,
    status: row.situacao ?? row.status,
    applicationDate: row.data_deposito ?? row.application_date,
    publicationDate: row.data_publicacao ?? row.publication_date,
    grantDate: row.data_concessao ?? row.grant_date,
    expirationDate: row.data_expiracao ?? row.expiration_date,
    ipcClasses: splitList(row.ipc ?? row.classificacao_ipc),
    applicants: splitList(row.depositantes ?? row.depositante).map((name) => ({ name })),
    inventors: splitList(row.inventores ?? row.inventor).map((name) => ({ name })),
  };
}
