/**
 * Re-indexa os embeddings de todos os chunks com o provider de IA atual.
 * Necessário ao trocar o AI_PROVIDER (os vetores de providers diferentes
 * não são comparáveis entre si).
 *
 * Execução: npm run ai:reembed
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { embeddingService, toVectorLiteral } from "../src/lib/ai/embedding-service";

const prisma = new PrismaClient();

async function main() {
  console.log(`🔁 Re-indexando embeddings com AI_PROVIDER=${process.env.AI_PROVIDER ?? "mock"}…`);

  const chunks = await prisma.$queryRaw<Array<{ id: string; content: string }>>`
    SELECT id, content FROM "DocumentChunk" ORDER BY "documentId", "chunkIndex"
  `;

  let done = 0;
  for (const chunk of chunks) {
    const embedding = await embeddingService.embedText(chunk.content);
    await prisma.$executeRaw`
      UPDATE "DocumentChunk"
      SET embedding = ${toVectorLiteral(embedding)}::vector
      WHERE id = ${chunk.id}
    `;
    done += 1;
    if (done % 10 === 0) console.log(`   ${done}/${chunks.length} chunks…`);
  }

  console.log(`✅ ${done} chunks re-indexados.`);
}

main()
  .catch((error) => {
    console.error("❌ Erro ao re-indexar:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
