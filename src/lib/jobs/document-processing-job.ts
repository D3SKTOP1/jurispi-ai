import { prisma } from "@/lib/db";
import { chunkExtraction } from "@/lib/documents/chunking";
import { extractText } from "@/lib/documents/text-extraction";
import { getStorage } from "@/lib/storage/storage";

import { generateEmbeddingsForDocument } from "./embedding-job";

/**
 * Job de processamento de documento:
 * 1. marca o documento como PROCESSING;
 * 2. lê o arquivo do storage;
 * 3. extrai o texto;
 * 4. gera chunks;
 * 5. gera embeddings (job de embeddings);
 * 6. marca como READY (ou ERROR, com mensagem).
 */
export async function processDocument(documentId: string): Promise<void> {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    console.warn(`[jobs] documento ${documentId} não encontrado; ignorando.`);
    return;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  try {
    const storage = getStorage();
    const buffer = await storage.read(document.fileUrl);

    const extraction = await extractText(buffer, document.mimeType);
    const chunks = chunkExtraction(extraction);

    if (chunks.length === 0) {
      throw new Error("Nenhum texto extraído do documento.");
    }

    // Reprocessamento: remove chunks antigos antes de recriar.
    await prisma.documentChunk.deleteMany({ where: { documentId } });

    await prisma.documentChunk.createMany({
      data: chunks.map((chunk) => ({
        documentId,
        organizationId: document.organizationId,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        metadata: { fileName: document.fileName, sourceType: document.sourceType },
      })),
    });

    await generateEmbeddingsForDocument(documentId);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "READY" },
    });

    console.log(`[jobs] documento ${documentId} processado: ${chunks.length} chunks.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido no processamento.";
    console.error(`[jobs] erro ao processar documento ${documentId}:`, error);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "ERROR", errorMessage: message.slice(0, 500) },
    });
  }
}
