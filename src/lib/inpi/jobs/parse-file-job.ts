import { prisma } from "@/lib/db";

import { readInpiRawFile } from "../inpi-file-storage";
import { logSync } from "../inpi-source-registry";
import { parseCsv } from "../parsers/csv-parser";

/**
 * (Re)parseia um arquivo bruto já armazenado, recriando os registros de
 * staging. Idempotente: registros anteriores do arquivo são substituídos;
 * a normalização subsequente faz upsert por processNumber.
 */
export async function parseInpiRawFile(rawFileId: string): Promise<{ records: number }> {
  const rawFile = await prisma.inpiRawFile.findUnique({ where: { id: rawFileId } });
  if (!rawFile) throw new Error("Arquivo bruto não encontrado.");

  const buffer = await readInpiRawFile(rawFile.filePath);
  const { rows, errors } = parseCsv(buffer);

  for (const err of errors) {
    await logSync({ jobId: rawFile.importJobId, level: "WARN", message: `Reparse CSV: ${err}` });
  }

  await prisma.inpiRawRecord.deleteMany({ where: { rawFileId } });

  let records = 0;
  for (const row of rows) {
    await prisma.inpiRawRecord.create({
      data: {
        rawFileId,
        entityType: rawFile.entityType,
        externalId: row.numero_processo ?? row.processo ?? null,
        rawData: row as never,
        status: "PENDING",
      },
    });
    records += 1;
  }

  await logSync({
    jobId: rawFile.importJobId,
    level: "INFO",
    message: `Arquivo ${rawFile.fileName} reparseado: ${records} registros em staging.`,
  });

  return { records };
}
