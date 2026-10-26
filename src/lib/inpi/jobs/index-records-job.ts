import { prisma } from "@/lib/db";

import { logSync } from "../inpi-source-registry";
import { normalizeText } from "../normalizers/text-normalizer";

/**
 * Jobs de (re)indexação: recomputam as colunas normalizadas usadas
 * pelos índices pg_trgm/FTS. Idempotentes — podem rodar a qualquer momento.
 */

export async function indexTrademarkRecords(): Promise<{ updated: number }> {
  const rows = await prisma.inpiTrademark.findMany({
    select: { id: true, brandName: true, normalizedName: true },
  });
  let updated = 0;
  for (const row of rows) {
    const normalized = normalizeText(row.brandName);
    if (normalized !== row.normalizedName) {
      await prisma.inpiTrademark.update({
        where: { id: row.id },
        data: { normalizedName: normalized },
      });
      updated += 1;
    }
  }
  await logSync({ level: "INFO", message: `Reindexação de marcas: ${updated} atualizadas.` });
  return { updated };
}

export async function indexPatentRecords(): Promise<{ updated: number }> {
  const rows = await prisma.inpiPatent.findMany({
    select: { id: true, title: true, normalizedTitle: true },
  });
  let updated = 0;
  for (const row of rows) {
    const normalized = normalizeText(row.title);
    if (normalized !== row.normalizedTitle) {
      await prisma.inpiPatent.update({
        where: { id: row.id },
        data: { normalizedTitle: normalized },
      });
      updated += 1;
    }
  }
  await logSync({ level: "INFO", message: `Reindexação de patentes: ${updated} atualizadas.` });
  return { updated };
}

/**
 * Embeddings de conteúdo INPI (resumos de patentes e despachos longos)
 * para busca semântica com pgvector — estrutura preparada.
 *
 * Implementação futura: vetorizar InpiPatent.abstractText e despachos
 * extensos em uma tabela de chunks vetoriais própria (padrão idêntico ao
 * DocumentChunk). No MVP a busca textual (FTS) cobre o caso de uso e este
 * job apenas reporta o que seria vetorizado.
 */
export async function generateInpiEmbeddings(): Promise<{ candidates: number }> {
  const candidates = await prisma.inpiPatent.count({
    where: { abstractText: { not: null } },
  });
  await logSync({
    level: "INFO",
    message: `Embeddings INPI preparados: ${candidates} resumo(s) de patente elegíveis (vetorização semântica planejada; busca textual ativa via FTS).`,
  });
  return { candidates };
}
