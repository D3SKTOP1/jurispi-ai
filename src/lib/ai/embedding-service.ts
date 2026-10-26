import { getAIProvider } from "./ai-provider";
import { EMBEDDING_DIMENSIONS } from "./types";

/**
 * Serviço de geração de embeddings.
 * Centraliza chamadas ao provider e garante a dimensão esperada pelo banco.
 */
export class EmbeddingService {
  async embedText(text: string): Promise<number[]> {
    const provider = getAIProvider();
    const { embedding } = await provider.generateEmbedding({ text: text.slice(0, 8_000) });

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding com dimensão inesperada: ${embedding.length} (esperado ${EMBEDDING_DIMENSIONS}).`
      );
    }
    return embedding;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embedText(text));
    }
    return results;
  }
}

export const embeddingService = new EmbeddingService();

/** Serializa um vetor para o formato aceito pelo pgvector: "[0.1,0.2,...]". */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
