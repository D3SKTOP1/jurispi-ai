import { prisma } from "@/lib/db";

import type { Citation, RetrievedChunk } from "./types";

const MAX_QUOTE_LENGTH = 280;

/**
 * Serviço de citações: transforma chunks recuperados em citações
 * rastreáveis e as persiste vinculadas às mensagens de IA.
 */
export class CitationService {
  buildFromChunks(chunks: RetrievedChunk[]): Citation[] {
    return chunks.map((chunk) => ({
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      sourceTitle: chunk.documentTitle,
      quote:
        chunk.content.length > MAX_QUOTE_LENGTH
          ? `${chunk.content.slice(0, MAX_QUOTE_LENGTH)}…`
          : chunk.content,
      pageNumber: chunk.pageNumber ?? undefined,
    }));
  }

  async saveForMessage(messageId: string, citations: Citation[]): Promise<void> {
    if (citations.length === 0) return;
    await prisma.aiCitation.createMany({
      data: citations.map((c) => ({
        messageId,
        documentId: c.documentId,
        chunkId: c.chunkId,
        sourceTitle: c.sourceTitle,
        quote: c.quote,
        pageNumber: c.pageNumber ?? null,
      })),
    });
  }
}

export const citationService = new CitationService();
