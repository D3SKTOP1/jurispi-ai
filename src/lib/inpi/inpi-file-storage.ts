import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Storage de arquivos BRUTOS do INPI (globais, auditáveis).
 * Separado do storage de uploads dos usuários (storage/uploads).
 * Todo arquivo é endereçado por checksum SHA-256 — a mesma origem
 * nunca é gravada duas vezes.
 *
 * Em produção (Vercel) o filesystem é somente leitura: com
 * BLOB_READ_WRITE_TOKEN configurado, os arquivos vão para o Vercel Blob
 * e o filePath gravado é a própria URL (https://…). Sem o token,
 * grava em disco local (desenvolvimento).
 */
const BASE_DIR = path.join(process.cwd(), "storage", "inpi");

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function checksumOf(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export interface SavedInpiFile {
  filePath: string;
  checksum: string;
  sizeBytes: number;
}

export async function saveInpiRawFile(input: {
  buffer: Buffer;
  fileName: string;
  sourceType: string;
}): Promise<SavedInpiFile> {
  const checksum = checksumOf(input.buffer);
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const relPath = path.posix.join(
    input.sourceType.toLowerCase(),
    `${checksum.slice(0, 12)}-${safeName}`
  );

  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`inpi/${relPath}`, input.buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/octet-stream",
    });
    return { filePath: blob.url, checksum, sizeBytes: input.buffer.length };
  }

  const fullPath = path.join(BASE_DIR, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, input.buffer);
  return { filePath: relPath, checksum, sizeBytes: input.buffer.length };
}

export async function readInpiRawFile(filePath: string): Promise<Buffer> {
  // Arquivos no Vercel Blob são endereçados pela própria URL.
  if (/^https?:\/\//.test(filePath)) {
    return downloadPublicFile(filePath, 60_000);
  }
  const fullPath = path.resolve(BASE_DIR, filePath);
  if (!fullPath.startsWith(path.resolve(BASE_DIR))) {
    throw new Error("Caminho de arquivo INPI inválido.");
  }
  return fs.readFile(fullPath);
}

/**
 * Download controlado de fonte oficial: timeout curto, user-agent
 * identificado e sem autenticação (somente conteúdo público).
 */
export async function downloadPublicFile(url: string, timeoutMs = 30_000): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "JurisPI-AI/0.1 (ingestao-dados-publicos)" },
    });
    if (!res.ok) {
      throw new Error(`Download falhou (${res.status}) para ${url}`);
    }
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}
