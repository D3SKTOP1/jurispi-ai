import { ApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

const memoryBuckets = new Map<string, number[]>();

/**
 * Rate limit por janela fixa, com contador em Postgres — vale entre
 * instâncias serverless (o limitador em memória de antes zerava a cada
 * cold start e não era compartilhado).
 *
 * Um único round-trip: INSERT ... ON CONFLICT ... incrementa e devolve o
 * contador da janela. Se o banco falhar, degrada para o limitador em
 * memória local (nunca derruba a operação por causa do rate limit).
 */
export async function enforceRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000
): Promise<void> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  try {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count")
      VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key", "windowStart")
      DO UPDATE SET "count" = "RateLimit"."count" + 1
      RETURNING "count"
    `;
    if ((rows[0]?.count ?? 1) > limit) {
      throw new ApiError(429, "Muitas requisições. Aguarde um instante e tente novamente.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Banco indisponível para o contador — usa a janela em memória local.
    console.error("[rate-limit] fallback em memória:", error);
    enforceMemoryLimit(key, limit, windowMs);
  }
}

function enforceMemoryLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const timestamps = (memoryBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    throw new ApiError(429, "Muitas requisições. Aguarde um instante e tente novamente.");
  }
  timestamps.push(now);
  memoryBuckets.set(key, timestamps);
}

/** Remove janelas antigas (chamado pelo cron diário). */
export async function cleanupRateLimits(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } });
  return result.count;
}
