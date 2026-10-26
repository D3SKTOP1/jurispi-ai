import crypto from "crypto";

import { unzipSync } from "fflate";

import { prisma } from "@/lib/db";

import {
  checksumOf,
  downloadPublicFile,
  readInpiRawFile,
  saveInpiRawFile,
} from "./inpi-file-storage";
import { logSync } from "./inpi-source-registry";
import {
  REVISTA_LABELS,
  REVISTA_SECTION_CODES,
  initialIssueMetadata,
  revistaPdfUrl,
  type RevistaProgress,
  type RpiIssueMetadata,
} from "./rpi-editions";
import {
  parseRealRpiHeader,
  parseRealRpiSlice,
  scanRealRpiChunks,
  type ParsedRealEntry,
  type RevistaKind,
} from "./parsers/rpi-real-parser";
import { normalizeProcessNumber, normalizeText, parseDateSafe } from "./normalizers/text-normalizer";

/**
 * Ingestão REAL da RPI em fatias serverless-safe.
 *
 * Cada chamada de `syncRealRpiSlice` processa uma fatia de uma revista
 * (Marcas → Patentes → Programa de computador) e devolve o progresso;
 * o cliente chama em loop até `done`. Estado da retomada fica em
 * RpiIssue.metadata.revistas — nenhuma chamada depende de memória local.
 *
 * Escritas SEMPRE em lote: createMany para despachos e upsert via
 * INSERT … ON CONFLICT (unnest) para as tabelas globais — uma edição de
 * marcas tem ~40 mil despachos; era inviável linha a linha.
 */

const SLICE_SIZE = 5_000;
const BATCH = 2_000;

const KIND_ORDER: RevistaKind[] = ["RM", "P", "PC"];

const KIND_ENTITY: Record<RevistaKind, string> = {
  RM: "TRADEMARK",
  P: "PATENT",
  PC: "SOFTWARE",
};

export interface RpiSliceProgress {
  done: boolean;
  rpiNumber: string;
  revista?: RevistaKind;
  revistaLabel?: string;
  cursor?: number;
  totalChunks?: number;
  dispatchesCreated?: number;
  alertsCreated?: number;
  message: string;
}

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function newId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Arquivo da revista (zip → XML), com cache no storage
// ---------------------------------------------------------------------------

function extractXmlFromZip(zipBuffer: Buffer): string {
  const entries = unzipSync(new Uint8Array(zipBuffer));
  const xmlNames = Object.keys(entries).filter((n) => n.toLowerCase().endsWith(".xml"));
  if (xmlNames.length === 0) {
    throw new Error("Zip da RPI sem arquivo XML.");
  }
  // Maior XML = conteúdo principal da revista.
  const main = xmlNames.sort((a, b) => entries[b].length - entries[a].length)[0];
  return Buffer.from(entries[main]).toString("utf-8");
}

async function loadRevistaXml(input: {
  issueId: string;
  rpiNumber: string;
  publishedAt: Date;
  kind: RevistaKind;
  progress: RevistaProgress;
}): Promise<{ xml: string; progress: RevistaProgress }> {
  const { kind, rpiNumber, progress } = input;

  // Cache: arquivo bruto já salvo em execução anterior.
  if (progress.filePath) {
    try {
      const cached = await readInpiRawFile(progress.filePath);
      return { xml: extractXmlFromZip(cached), progress };
    } catch {
      // Cache inacessível — baixa de novo da fonte oficial.
    }
  }

  const buffer = await downloadPublicFile(progress.url, 120_000);
  const checksum = checksumOf(buffer);
  const fileName = `${kind}${rpiNumber}.zip`;

  let rawFile = await prisma.inpiRawFile.findUnique({ where: { checksum } });
  let jobId = progress.jobId;
  if (!rawFile) {
    const job = await prisma.inpiImportJob.create({
      data: {
        sourceType: "RPI",
        entityType: KIND_ENTITY[kind],
        status: "RUNNING",
        fileUrl: progress.url,
        fileName,
        checksum,
        startedAt: new Date(),
      },
    });
    jobId = job.id;
    const saved = await saveInpiRawFile({ buffer, fileName, sourceType: "RPI" });
    rawFile = await prisma.inpiRawFile.create({
      data: {
        importJobId: job.id,
        sourceType: "RPI",
        entityType: KIND_ENTITY[kind],
        originalUrl: progress.url,
        fileName,
        filePath: saved.filePath,
        mimeType: "application/zip",
        checksum,
        sizeBytes: saved.sizeBytes,
        rpiNumber,
        rpiDate: input.publishedAt,
        section: REVISTA_SECTION_CODES[kind],
      },
    });
  }

  return {
    xml: extractXmlFromZip(buffer),
    progress: {
      ...progress,
      jobId: jobId ?? rawFile.importJobId,
      rawFileId: rawFile.id,
      filePath: rawFile.filePath,
    },
  };
}

// ---------------------------------------------------------------------------
// Escrita em lote
// ---------------------------------------------------------------------------

async function ingestDispatches(input: {
  entries: ParsedRealEntry[];
  rpiSectionId: string;
  rpiNumber: string;
  rpiDate: Date | null;
  sectionCode: string;
  sourceFileId: string | null;
  kind: RevistaKind;
}): Promise<{ created: number }> {
  const rows = input.entries.flatMap((e) =>
    e.dispatches.map((d) => ({
      processNumber: normalizeProcessNumber(d.processNumber),
      dispatchCode: d.dispatchCode ?? null,
      dispatchText: d.dispatchText,
      holderName: d.holderName ?? null,
      title: d.title ?? null,
    }))
  );
  if (rows.length === 0) return { created: 0 };

  const keyOf = (r: { processNumber: string; dispatchCode: string | null; dispatchText: string }) =>
    `${r.processNumber}|${r.dispatchCode ?? ""}|${r.dispatchText}`;

  // Dedupe interno da fatia + contra o que já existe na seção (reexecução).
  const processNumbers = [...new Set(rows.map((r) => r.processNumber))];
  const existingKeys = new Set<string>();
  for (const batch of chunked(processNumbers, BATCH)) {
    const existing = await prisma.rpiDispatch.findMany({
      where: { rpiSectionId: input.rpiSectionId, processNumber: { in: batch } },
      select: { processNumber: true, dispatchCode: true, dispatchText: true },
    });
    for (const e of existing) existingKeys.add(keyOf(e));
  }

  const fresh: typeof rows = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    fresh.push(row);
  }

  for (const batch of chunked(fresh, BATCH)) {
    await prisma.rpiDispatch.createMany({
      data: batch.map((r) => ({ rpiSectionId: input.rpiSectionId, ...r })),
    });
  }

  // Réplica no histórico por processo (marca/patente) com vínculo ao global.
  if (input.kind !== "PC" && fresh.length > 0) {
    const table = input.kind === "RM" ? "trademark" : "patent";
    const idMap = new Map<string, string>();
    for (const batch of chunked(processNumbers, BATCH)) {
      const found =
        table === "trademark"
          ? await prisma.inpiTrademark.findMany({
              where: { processNumber: { in: batch } },
              select: { id: true, processNumber: true },
            })
          : await prisma.inpiPatent.findMany({
              where: { processNumber: { in: batch } },
              select: { id: true, processNumber: true },
            });
      for (const f of found) idMap.set(f.processNumber, f.id);
    }

    const replicaExisting = new Set<string>();
    for (const batch of chunked(processNumbers, BATCH)) {
      const existing =
        table === "trademark"
          ? await prisma.inpiTrademarkDispatch.findMany({
              where: { rpiNumber: input.rpiNumber, processNumber: { in: batch } },
              select: { processNumber: true, dispatchCode: true, dispatchText: true },
            })
          : await prisma.inpiPatentDispatch.findMany({
              where: { rpiNumber: input.rpiNumber, processNumber: { in: batch } },
              select: { processNumber: true, dispatchCode: true, dispatchText: true },
            });
      for (const e of existing) replicaExisting.add(keyOf(e));
    }

    const replicaRows = fresh.filter((r) => !replicaExisting.has(keyOf(r)));
    for (const batch of chunked(replicaRows, BATCH)) {
      if (table === "trademark") {
        await prisma.inpiTrademarkDispatch.createMany({
          data: batch.map((r) => ({
            trademarkId: idMap.get(r.processNumber) ?? null,
            processNumber: r.processNumber,
            rpiNumber: input.rpiNumber,
            rpiDate: input.rpiDate,
            dispatchCode: r.dispatchCode,
            dispatchText: r.dispatchText,
            section: input.sectionCode,
            sourceFileId: input.sourceFileId,
          })),
        });
      } else {
        await prisma.inpiPatentDispatch.createMany({
          data: batch.map((r) => ({
            patentId: idMap.get(r.processNumber) ?? null,
            processNumber: r.processNumber,
            rpiNumber: input.rpiNumber,
            rpiDate: input.rpiDate,
            dispatchCode: r.dispatchCode,
            dispatchText: r.dispatchText,
            section: input.sectionCode,
            sourceFileId: input.sourceFileId,
          })),
        });
      }
    }
  }

  return { created: fresh.length };
}

const RPI_SOURCE = "RPI — Revista da Propriedade Industrial";

async function upsertTrademarks(entries: ParsedRealEntry[]): Promise<void> {
  // Último snapshot vence quando o mesmo processo aparece duas vezes na fatia.
  const byProcess = new Map<string, NonNullable<ParsedRealEntry["trademark"]>>();
  for (const e of entries) {
    if (!e.trademark) continue;
    byProcess.set(normalizeProcessNumber(e.trademark.processNumber), e.trademark);
  }
  if (byProcess.size === 0) return;

  const named: Array<[string, NonNullable<ParsedRealEntry["trademark"]>]> = [];
  const unnamed: Array<[string, NonNullable<ParsedRealEntry["trademark"]>]> = [];
  for (const pair of byProcess.entries()) {
    (pair[1].brandName ? named : unnamed).push(pair);
  }

  // 1. Marcas com nome publicado: upsert completo.
  for (const batch of chunked(named, BATCH)) {
    const ids = batch.map(() => newId());
    const pns = batch.map(([pn]) => pn);
    const brands = batch.map(([, t]) => t.brandName ?? "");
    const norms = batch.map(([, t]) => normalizeText(t.brandName ?? ""));
    const holders = batch.map(([, t]) => t.holderName ?? "");
    const presentations = batch.map(([, t]) => t.presentation ?? "");
    const natures = batch.map(([, t]) => t.nature ?? "");
    const statuses = batch.map(([, t]) => t.status ?? "");
    const appDates = batch.map(([, t]) => parseDateSafe(t.applicationDate)?.toISOString() ?? "");
    const regDates = batch.map(([, t]) => parseDateSafe(t.registrationDate)?.toISOString() ?? "");
    const expDates = batch.map(([, t]) => parseDateSafe(t.expirationDate)?.toISOString() ?? "");

    await prisma.$executeRaw`
      INSERT INTO "InpiTrademark" (
        "id","processNumber","brandName","normalizedName","holderName","presentation",
        "nature","status","applicationDate","registrationDate","expirationDate",
        "source","sourceUpdatedAt","updatedAt"
      )
      SELECT t.id, t.pn, t.brand, t.norm, NULLIF(t.holder,''), NULLIF(t.pres,''),
             NULLIF(t.nat,''), NULLIF(t.st,''), NULLIF(t.appdt,'')::timestamp,
             NULLIF(t.regdt,'')::timestamp, NULLIF(t.expdt,'')::timestamp,
             ${RPI_SOURCE}, NOW(), NOW()
      FROM unnest(
        ${ids}::text[], ${pns}::text[], ${brands}::text[], ${norms}::text[],
        ${holders}::text[], ${presentations}::text[], ${natures}::text[], ${statuses}::text[],
        ${appDates}::text[], ${regDates}::text[], ${expDates}::text[]
      ) AS t(id, pn, brand, norm, holder, pres, nat, st, appdt, regdt, expdt)
      ON CONFLICT ("processNumber") DO UPDATE SET
        "brandName" = CASE WHEN EXCLUDED."brandName" <> '' THEN EXCLUDED."brandName" ELSE "InpiTrademark"."brandName" END,
        "normalizedName" = CASE WHEN EXCLUDED."normalizedName" <> '' THEN EXCLUDED."normalizedName" ELSE "InpiTrademark"."normalizedName" END,
        "holderName" = COALESCE(EXCLUDED."holderName", "InpiTrademark"."holderName"),
        "presentation" = COALESCE(EXCLUDED."presentation", "InpiTrademark"."presentation"),
        "nature" = COALESCE(EXCLUDED."nature", "InpiTrademark"."nature"),
        "status" = COALESCE(EXCLUDED."status", "InpiTrademark"."status"),
        "applicationDate" = COALESCE(EXCLUDED."applicationDate", "InpiTrademark"."applicationDate"),
        "registrationDate" = COALESCE(EXCLUDED."registrationDate", "InpiTrademark"."registrationDate"),
        "expirationDate" = COALESCE(EXCLUDED."expirationDate", "InpiTrademark"."expirationDate"),
        "source" = EXCLUDED."source",
        "sourceUpdatedAt" = NOW(),
        "updatedAt" = NOW()
    `;
  }

  // 2. Sem nome publicado nesta edição: apenas atualiza situação/datas de
  //    processos que já existem na base (não cria registro sem marca).
  for (const batch of chunked(unnamed, BATCH)) {
    const pns = batch.map(([pn]) => pn);
    const statuses = batch.map(([, t]) => t.status ?? "");
    const appDates = batch.map(([, t]) => parseDateSafe(t.applicationDate)?.toISOString() ?? "");
    const regDates = batch.map(([, t]) => parseDateSafe(t.registrationDate)?.toISOString() ?? "");
    const expDates = batch.map(([, t]) => parseDateSafe(t.expirationDate)?.toISOString() ?? "");

    await prisma.$executeRaw`
      UPDATE "InpiTrademark" AS tm SET
        "status" = COALESCE(NULLIF(t.st,''), tm."status"),
        "applicationDate" = COALESCE(NULLIF(t.appdt,'')::timestamp, tm."applicationDate"),
        "registrationDate" = COALESCE(NULLIF(t.regdt,'')::timestamp, tm."registrationDate"),
        "expirationDate" = COALESCE(NULLIF(t.expdt,'')::timestamp, tm."expirationDate"),
        "sourceUpdatedAt" = NOW(),
        "updatedAt" = NOW()
      FROM unnest(
        ${pns}::text[], ${statuses}::text[], ${appDates}::text[], ${regDates}::text[], ${expDates}::text[]
      ) AS t(pn, st, appdt, regdt, expdt)
      WHERE tm."processNumber" = t.pn
    `;
  }

  // 3. Classes Nice e titulares: substituição em lote para os processos com dados.
  const withClasses = named.filter(([, t]) => t.niceClasses.length > 0);
  const withApplicants = named.filter(([, t]) => t.applicants.length > 0);
  const affectedPns = [
    ...new Set([...withClasses, ...withApplicants].map(([pn]) => pn)),
  ];
  if (affectedPns.length === 0) return;

  const idMap = new Map<string, string>();
  for (const batch of chunked(affectedPns, BATCH)) {
    const found = await prisma.inpiTrademark.findMany({
      where: { processNumber: { in: batch } },
      select: { id: true, processNumber: true },
    });
    for (const f of found) idMap.set(f.processNumber, f.id);
  }

  const classIds = withClasses.map(([pn]) => idMap.get(pn)).filter(Boolean) as string[];
  for (const batch of chunked(classIds, BATCH)) {
    await prisma.inpiTrademarkClass.deleteMany({ where: { trademarkId: { in: batch } } });
  }
  const classRows = withClasses.flatMap(([pn, t]) => {
    const id = idMap.get(pn);
    if (!id) return [];
    return t.niceClasses.map((c) => ({
      trademarkId: id,
      niceClass: c.niceClass.padStart(2, "0"),
      specification: c.specification ?? null,
    }));
  });
  for (const batch of chunked(classRows, BATCH)) {
    await prisma.inpiTrademarkClass.createMany({ data: batch });
  }

  const applicantIds = withApplicants.map(([pn]) => idMap.get(pn)).filter(Boolean) as string[];
  for (const batch of chunked(applicantIds, BATCH)) {
    await prisma.inpiTrademarkApplicant.deleteMany({ where: { trademarkId: { in: batch } } });
  }
  const applicantRows = withApplicants.flatMap(([pn, t]) => {
    const id = idMap.get(pn);
    if (!id) return [];
    return t.applicants.map((a) => ({
      trademarkId: id,
      name: a.name,
      country: a.country ?? null,
    }));
  });
  for (const batch of chunked(applicantRows, BATCH)) {
    await prisma.inpiTrademarkApplicant.createMany({ data: batch });
  }
}

async function upsertPatents(entries: ParsedRealEntry[]): Promise<void> {
  const byProcess = new Map<string, NonNullable<ParsedRealEntry["patent"]>>();
  for (const e of entries) {
    if (!e.patent) continue;
    byProcess.set(normalizeProcessNumber(e.patent.processNumber), e.patent);
  }
  if (byProcess.size === 0) return;

  const pairs = [...byProcess.entries()];
  for (const batch of chunked(pairs, BATCH)) {
    const ids = batch.map(() => newId());
    const pns = batch.map(([pn]) => pn);
    const titles = batch.map(([, p]) => p.title ?? "");
    const norms = batch.map(([, p]) => (p.title ? normalizeText(p.title) : ""));
    const statuses = batch.map(([, p]) => p.status ?? "");
    const appDates = batch.map(([, p]) => parseDateSafe(p.applicationDate)?.toISOString() ?? "");

    await prisma.$executeRaw`
      INSERT INTO "InpiPatent" (
        "id","processNumber","title","normalizedTitle","status","applicationDate",
        "source","sourceUpdatedAt","updatedAt"
      )
      SELECT t.id, t.pn, COALESCE(NULLIF(t.title,''), '(título não publicado na RPI)'),
             NULLIF(t.norm,''), NULLIF(t.st,''), NULLIF(t.appdt,'')::timestamp,
             ${RPI_SOURCE}, NOW(), NOW()
      FROM unnest(
        ${ids}::text[], ${pns}::text[], ${titles}::text[], ${norms}::text[],
        ${statuses}::text[], ${appDates}::text[]
      ) AS t(id, pn, title, norm, st, appdt)
      ON CONFLICT ("processNumber") DO UPDATE SET
        "title" = CASE WHEN EXCLUDED."title" <> '(título não publicado na RPI)' THEN EXCLUDED."title" ELSE "InpiPatent"."title" END,
        "normalizedTitle" = COALESCE(EXCLUDED."normalizedTitle", "InpiPatent"."normalizedTitle"),
        "status" = COALESCE(EXCLUDED."status", "InpiPatent"."status"),
        "applicationDate" = COALESCE(EXCLUDED."applicationDate", "InpiPatent"."applicationDate"),
        "source" = EXCLUDED."source",
        "sourceUpdatedAt" = NOW(),
        "updatedAt" = NOW()
    `;
  }

  const withDetails = pairs.filter(
    ([, p]) => p.ipcCodes.length > 0 || p.applicants.length > 0 || p.inventors.length > 0
  );
  if (withDetails.length === 0) return;

  const idMap = new Map<string, string>();
  for (const batch of chunked(withDetails.map(([pn]) => pn), BATCH)) {
    const found = await prisma.inpiPatent.findMany({
      where: { processNumber: { in: batch } },
      select: { id: true, processNumber: true },
    });
    for (const f of found) idMap.set(f.processNumber, f.id);
  }

  const detailIds = withDetails.map(([pn]) => idMap.get(pn)).filter(Boolean) as string[];
  for (const batch of chunked(detailIds, BATCH)) {
    await prisma.inpiPatentIpcClass.deleteMany({ where: { patentId: { in: batch } } });
    await prisma.inpiPatentApplicant.deleteMany({ where: { patentId: { in: batch } } });
    await prisma.inpiPatentInventor.deleteMany({ where: { patentId: { in: batch } } });
  }

  const ipcRows = withDetails.flatMap(([pn, p]) => {
    const id = idMap.get(pn);
    if (!id) return [];
    return [...new Set(p.ipcCodes)].map((code) => ({ patentId: id, ipcCode: code }));
  });
  for (const batch of chunked(ipcRows, BATCH)) {
    await prisma.inpiPatentIpcClass.createMany({ data: batch });
  }

  const applicantRows = withDetails.flatMap(([pn, p]) => {
    const id = idMap.get(pn);
    if (!id) return [];
    return p.applicants.map((a) => ({ patentId: id, name: a.name, country: a.country ?? null }));
  });
  for (const batch of chunked(applicantRows, BATCH)) {
    await prisma.inpiPatentApplicant.createMany({ data: batch });
  }

  const inventorRows = withDetails.flatMap(([pn, p]) => {
    const id = idMap.get(pn);
    if (!id) return [];
    return p.inventors.map((name) => ({ patentId: id, name }));
  });
  for (const batch of chunked(inventorRows, BATCH)) {
    await prisma.inpiPatentInventor.createMany({ data: batch });
  }
}

// ---------------------------------------------------------------------------
// Orquestração da fatia
// ---------------------------------------------------------------------------

/**
 * Processa a próxima fatia pendente da edição. Idempotente e retomável:
 * o progresso por revista fica em RpiIssue.metadata.revistas.
 */
export async function syncRealRpiSlice(rpiNumber: string): Promise<RpiSliceProgress> {
  const issue = await prisma.rpiIssue.findUnique({ where: { number: rpiNumber } });
  if (!issue) {
    throw new Error(`RPI ${rpiNumber} não registrada. Rode a descoberta de edições antes.`);
  }

  const metadata = (issue.metadata ?? {}) as RpiIssueMetadata;
  const revistas = {
    ...initialIssueMetadata(rpiNumber).revistas!,
    ...(metadata.revistas ?? {}),
  } as Record<RevistaKind, RevistaProgress>;

  const kind = KIND_ORDER.find(
    (k) => revistas[k].status !== "COMPLETED" && revistas[k].status !== "UNAVAILABLE"
  );

  if (!kind) {
    if (issue.status !== "PROCESSED") {
      await prisma.rpiIssue.update({
        where: { id: issue.id },
        data: { status: "PROCESSED", metadata: { ...metadata, revistas } as never },
      });
    }
    return {
      done: true,
      rpiNumber,
      message: `RPI ${rpiNumber} já sincronizada.`,
    };
  }

  let progress = revistas[kind];

  // Carrega (ou baixa) o XML da revista.
  let xml: string;
  try {
    const loaded = await loadRevistaXml({
      issueId: issue.id,
      rpiNumber,
      publishedAt: issue.publishedAt,
      kind,
      progress,
    });
    xml = loaded.xml;
    progress = loaded.progress;
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro no download";
    // Revista pode não existir para a edição (ex.: sem arquivo estruturado).
    revistas[kind] = { ...progress, status: "UNAVAILABLE", error: message.slice(0, 300) };
    await prisma.rpiIssue.update({
      where: { id: issue.id },
      data: { status: "PROCESSING", metadata: { ...metadata, revistas } as never },
    });
    await logSync({
      level: "WARN",
      message: `RPI ${rpiNumber}/${kind}: arquivo estruturado indisponível (${message.slice(0, 120)}).`,
    });
    return {
      done: false,
      rpiNumber,
      revista: kind,
      revistaLabel: REVISTA_LABELS[kind],
      message: `${REVISTA_LABELS[kind]}: arquivo indisponível nesta edição — seguindo para a próxima revista.`,
    };
  }

  // Corrige a data de publicação com a data impressa no XML.
  const header = parseRealRpiHeader(xml);
  const printedDate = parseDateSafe(header.publishedAt);
  if (printedDate && Math.abs(printedDate.getTime() - issue.publishedAt.getTime()) > 86_400_000) {
    await prisma.rpiIssue.update({
      where: { id: issue.id },
      data: { publishedAt: printedDate },
    });
  }
  const rpiDate = printedDate ?? issue.publishedAt;

  // Seção da revista dentro da edição.
  const sectionCode = REVISTA_SECTION_CODES[kind];
  let section = await prisma.rpiSection.findFirst({
    where: { rpiIssueId: issue.id, sectionCode },
  });
  if (!section) {
    section = await prisma.rpiSection.create({
      data: {
        rpiIssueId: issue.id,
        sectionCode,
        name: REVISTA_LABELS[kind],
        xmlUrl: progress.url,
        pdfUrl: revistaPdfUrl(kind, rpiNumber),
        status: "PROCESSING",
      },
    });
  }

  const chunks = scanRealRpiChunks(xml, kind);
  const cursor = progress.cursor ?? 0;
  const entries = parseRealRpiSlice(xml, kind, chunks, cursor, SLICE_SIZE);

  const { created } = await ingestDispatches({
    entries,
    rpiSectionId: section.id,
    rpiNumber,
    rpiDate,
    sectionCode,
    sourceFileId: progress.rawFileId ?? null,
    kind,
  });

  if (kind === "RM") await upsertTrademarks(entries);
  if (kind === "P") await upsertPatents(entries);

  const nextCursor = Math.min(cursor + SLICE_SIZE, chunks.length);
  const finishedRevista = nextCursor >= chunks.length;

  revistas[kind] = {
    ...progress,
    cursor: nextCursor,
    totalChunks: chunks.length,
    status: finishedRevista ? "COMPLETED" : "RUNNING",
  };

  if (progress.jobId) {
    await prisma.inpiImportJob.update({
      where: { id: progress.jobId },
      data: {
        totalRecords: chunks.length,
        processedRecords: nextCursor,
        ...(finishedRevista ? { status: "COMPLETED", finishedAt: new Date() } : {}),
      },
    }).catch(() => undefined);
  }

  if (finishedRevista) {
    await prisma.rpiSection.update({
      where: { id: section.id },
      data: { status: "PROCESSED" },
    });
  }

  const allDone = KIND_ORDER.every(
    (k) => revistas[k].status === "COMPLETED" || revistas[k].status === "UNAVAILABLE"
  );

  await prisma.rpiIssue.update({
    where: { id: issue.id },
    data: {
      status: allDone ? "PROCESSED" : "PROCESSING",
      metadata: { ...metadata, revistas } as never,
    },
  });

  // Ao fechar uma revista, cruza com os processos monitorados (barato:
  // parte dos números monitorados, não dos ~40 mil despachos da edição).
  let alertsCreated: number | undefined;
  if (finishedRevista) {
    const { inpiMonitoringService } = await import("./monitoring/inpi-monitoring-service");
    const result = await inpiMonitoringService.matchMonitoredProcesses(rpiNumber);
    alertsCreated = result.alertsCreated;
    await logSync({
      level: "INFO",
      message: `RPI ${rpiNumber} — ${REVISTA_LABELS[kind]}: ${chunks.length} registros processados, ${result.alertsCreated} alertas.`,
    });
  }

  return {
    done: allDone,
    rpiNumber,
    revista: kind,
    revistaLabel: REVISTA_LABELS[kind],
    cursor: nextCursor,
    totalChunks: chunks.length,
    dispatchesCreated: created,
    alertsCreated,
    message: allDone
      ? `RPI ${rpiNumber} sincronizada por completo.`
      : `${REVISTA_LABELS[kind]}: ${nextCursor.toLocaleString("pt-BR")} de ${chunks.length.toLocaleString("pt-BR")} registros.`,
  };
}

/** Sincroniza a edição inteira em loop — para workers/scripts (sem timeout). */
export async function syncRealRpiIssueFully(
  rpiNumber: string
): Promise<{ slices: number; alertsCreated: number }> {
  let slices = 0;
  let alerts = 0;
  for (;;) {
    const progress = await syncRealRpiSlice(rpiNumber);
    slices += 1;
    alerts += progress.alertsCreated ?? 0;
    if (progress.done) return { slices, alertsCreated: alerts };
    if (slices > 500) throw new Error("Sincronização excedeu o limite de fatias (loop?).");
  }
}
