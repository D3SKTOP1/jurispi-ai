import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Abstração de storage de arquivos.
 * O MVP usa storage local em disco; a interface está pronta para
 * S3, Cloudflare R2, MinIO ou equivalente.
 */
export interface FileStorage {
  /** Salva um arquivo e retorna a chave/URL interna. */
  save(input: { buffer: Buffer; fileName: string; organizationId: string; contentType: string }): Promise<{ key: string }>;
  /** Lê o conteúdo de um arquivo a partir da chave. */
  read(key: string): Promise<Buffer>;
  /** Remove um arquivo (best-effort). */
  remove(key: string): Promise<void>;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

class LocalFileStorage implements FileStorage {
  private baseDir = path.join(process.cwd(), "storage", "uploads");

  private resolveSafe(key: string): string {
    const full = path.resolve(this.baseDir, key);
    if (!full.startsWith(path.resolve(this.baseDir))) {
      throw new Error("Chave de arquivo inválida.");
    }
    return full;
  }

  async save(input: {
    buffer: Buffer;
    fileName: string;
    organizationId: string;
    contentType: string;
  }): Promise<{ key: string }> {
    const safeName = sanitizeFileName(input.fileName);
    const key = path.posix.join(
      input.organizationId,
      `${crypto.randomUUID()}-${safeName}`
    );
    const fullPath = this.resolveSafe(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return { key };
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveSafe(key));
  }

  async remove(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolveSafe(key));
    } catch {
      // best-effort
    }
  }
}

/**
 * Adaptador Vercel Blob — storage gerenciado para deploy serverless
 * (o filesystem do Vercel é efêmero). A key gravada em Document.fileUrl
 * é a própria URL do blob (com sufixo aleatório não adivinhável);
 * o acesso dos usuários continua passando pelos route handlers
 * autenticados com checagem de organização.
 */
class VercelBlobStorage implements FileStorage {
  constructor() {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error(
        "Vercel Blob não configurado. Defina BLOB_READ_WRITE_TOKEN (criado automaticamente ao adicionar um Blob store ao projeto Vercel)."
      );
    }
  }

  async save(input: {
    buffer: Buffer;
    fileName: string;
    organizationId: string;
    contentType: string;
  }): Promise<{ key: string }> {
    const { put } = await import("@vercel/blob");
    const safeName = sanitizeFileName(input.fileName);
    const blob = await put(
      `uploads/${input.organizationId}/${crypto.randomUUID()}-${safeName}`,
      input.buffer,
      { access: "public", contentType: input.contentType }
    );
    return { key: blob.url };
  }

  async read(key: string): Promise<Buffer> {
    if (!key.startsWith("https://")) {
      throw new Error("Chave de blob inválida.");
    }
    const res = await fetch(key);
    if (!res.ok) {
      throw new Error(`Falha ao ler arquivo do Blob (${res.status}).`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    try {
      const { del } = await import("@vercel/blob");
      await del(key);
    } catch {
      // best-effort
    }
  }
}

/**
 * Adaptador S3/R2/MinIO — estrutura pronta, implementação futura.
 * Configure STORAGE_PROVIDER=s3 e as variáveis S3_* no .env.
 */
class S3FileStorage implements FileStorage {
  constructor() {
    if (!process.env.S3_ENDPOINT || !process.env.S3_BUCKET) {
      throw new Error("Storage S3 não configurado. Defina S3_ENDPOINT e S3_BUCKET no .env.");
    }
  }

  async save(): Promise<{ key: string }> {
    throw new Error("Adaptador S3 ainda não implementado no MVP. Use STORAGE_PROVIDER=local.");
  }

  async read(): Promise<Buffer> {
    throw new Error("Adaptador S3 ainda não implementado no MVP. Use STORAGE_PROVIDER=local.");
  }

  async remove(): Promise<void> {
    throw new Error("Adaptador S3 ainda não implementado no MVP. Use STORAGE_PROVIDER=local.");
  }
}

let storageInstance: FileStorage | null = null;

export function getStorage(): FileStorage {
  if (!storageInstance) {
    const provider = process.env.STORAGE_PROVIDER ?? "local";
    storageInstance =
      provider === "vercel-blob"
        ? new VercelBlobStorage()
        : provider === "s3"
          ? new S3FileStorage()
          : new LocalFileStorage();
  }
  return storageInstance;
}
