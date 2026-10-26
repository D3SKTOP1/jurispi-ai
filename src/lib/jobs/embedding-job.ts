import { prisma } from "@/lib/db";
import { embeddingService, toVectorLiteral } from "@/lib/ai/embedding-service";

/**
 * Job de embeddings: gera e grava o vetor pgvector de cada chunk
 * de um documento que ainda não possui embedding.
 */
export async function generateEmbeddingsForDocument(documentId: string): Promise<number> {
  const chunks = await prisma.$queryRaw<Array<{ id: string; content: string }>>`
    SELECT id, content FROM "DocumentChunk"
    WHERE "documentId" = ${documentId} AND embedding IS NULL
    ORDER BY "chunkIndex"
  `;

  let updated = 0;
  for (const chunk of chunks) {
    const embedding = await embeddingService.embedText(chunk.content);
    await prisma.$executeRaw`
      UPDATE "DocumentChunk"
      SET embedding = ${toVectorLiteral(embedding)}::vector
      WHERE id = ${chunk.id}
    `;
    updated += 1;
  }

  return updated;
}
