import { prisma } from "@/lib/db";

import { logSync } from "./inpi-source-registry";
import type { RevistaKind } from "./parsers/rpi-real-parser";

/**
 * Descoberta REAL de edições da RPI em revistas.inpi.gov.br.
 *
 * O índice público lista as edições recentes (links Marcas{n}.pdf etc.);
 * os arquivos estruturados ficam em /txt/{RM|P|PC}{n}.zip. A descoberta
 * registra cada edição nova como RpiIssue com as URLs das três revistas
 * no metadata — a sincronização consome esse metadata em fatias.
 */

export const RPI_INDEX_URL = "https://revistas.inpi.gov.br/rpi/";

export const REVISTA_LABELS: Record<RevistaKind, string> = {
  RM: "Marcas",
  P: "Patentes",
  PC: "Programa de computador",
};

export const REVISTA_SECTION_CODES: Record<RevistaKind, string> = {
  RM: "MARCAS",
  P: "PATENTES",
  PC: "PROGRAMAS",
};

export function revistaZipUrl(kind: RevistaKind, rpiNumber: string): string {
  return `https://revistas.inpi.gov.br/txt/${kind}${rpiNumber}.zip`;
}

export function revistaPdfUrl(kind: RevistaKind, rpiNumber: string): string {
  const pdfName: Record<RevistaKind, string> = {
    RM: "Marcas",
    P: "Patentes",
    PC: "Programa_de_computador",
  };
  return `https://revistas.inpi.gov.br/pdf/${pdfName[kind]}${rpiNumber}.pdf`;
}

export interface RevistaProgress {
  url: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "UNAVAILABLE" | "FAILED";
  cursor?: number;
  totalChunks?: number;
  jobId?: string;
  rawFileId?: string;
  filePath?: string;
  error?: string;
}

export interface RpiIssueMetadata {
  revistas?: Partial<Record<RevistaKind, RevistaProgress>>;
  [key: string]: unknown;
}

/** Metadata inicial de uma edição real (URLs das três revistas). */
export function initialIssueMetadata(rpiNumber: string): RpiIssueMetadata {
  return {
    revistas: {
      RM: { url: revistaZipUrl("RM", rpiNumber), status: "PENDING" },
      P: { url: revistaZipUrl("P", rpiNumber), status: "PENDING" },
      PC: { url: revistaZipUrl("PC", rpiNumber), status: "PENDING" },
    },
  };
}

/** Data de publicação aproximada via Last-Modified do zip de marcas. */
async function probePublishedAt(rpiNumber: string): Promise<Date | null> {
  try {
    const res = await fetch(revistaZipUrl("RM", rpiNumber), {
      method: "HEAD",
      headers: { "user-agent": "JurisPI-AI/0.1 (ingestao-dados-publicos)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const lastModified = res.headers.get("last-modified");
    if (!lastModified) return null;
    const date = new Date(lastModified);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Busca o índice oficial e registra edições ainda não conhecidas.
 * `limit` restringe quantas edições recentes registrar (evita backfill
 * acidental de anos de histórico).
 */
export async function discoverRealRpiEditions(options?: {
  limit?: number;
}): Promise<{ discovered: string[]; latestAvailable: string | null }> {
  const limit = options?.limit ?? 4;

  const res = await fetch(RPI_INDEX_URL, {
    headers: { "user-agent": "JurisPI-AI/0.1 (ingestao-dados-publicos)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Índice da RPI indisponível (HTTP ${res.status}).`);
  }
  const html = await res.text();

  const numbers = [...new Set([...html.matchAll(/Marcas(\d{3,5})\.pdf/g)].map((m) => m[1]))]
    .sort((a, b) => Number(b) - Number(a))
    .slice(0, limit);

  if (numbers.length === 0) {
    throw new Error("Nenhuma edição encontrada no índice da RPI (layout pode ter mudado).");
  }

  const discovered: string[] = [];
  for (const number of numbers) {
    const existing = await prisma.rpiIssue.findUnique({ where: { number } });
    if (existing) {
      // Edições fixture antigas não têm as URLs reais — completa o metadata.
      const meta = (existing.metadata ?? {}) as RpiIssueMetadata;
      if (!meta.revistas) {
        await prisma.rpiIssue.update({
          where: { id: existing.id },
          data: { metadata: { ...meta, ...initialIssueMetadata(number) } as never },
        });
      }
      continue;
    }

    const publishedAt = (await probePublishedAt(number)) ?? new Date();
    await prisma.rpiIssue.create({
      data: {
        number,
        publishedAt,
        sourceUrl: RPI_INDEX_URL,
        status: "DISCOVERED",
        metadata: initialIssueMetadata(number) as never,
      },
    });
    discovered.push(number);
  }

  await logSync({
    level: "INFO",
    message:
      discovered.length > 0
        ? `Descoberta de RPI: edição(ões) ${discovered.join(", ")} registrada(s) a partir do índice oficial.`
        : `Descoberta de RPI: nenhuma edição nova (mais recente disponível: ${numbers[0]}).`,
  });

  return { discovered, latestAvailable: numbers[0] ?? null };
}
