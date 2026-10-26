import { prisma } from "@/lib/db";

import { getAIProvider } from "./ai-provider";
import { citationService } from "./citation-service";
import { embeddingService, toVectorLiteral } from "./embedding-service";
import { buildRagPrompt, SYSTEM_PROMPT } from "./prompts";
import type { RagQuestionInput, RagQuestionResult, RetrievedChunk } from "./types";

const TOP_K = 8;

interface RawChunkRow {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number;
}

/**
 * RagService — pipeline completo de Retrieval-Augmented Generation:
 * 1. recebe a pergunta do usuário;
 * 2. escopa por organizationId (e caseId, quando houver);
 * 3. gera o embedding da pergunta;
 * 4. busca os chunks mais relevantes via pgvector (distância de cosseno);
 * 5. monta o contexto;
 * 6. chama o AIProvider;
 * 7. persiste mensagens e citações;
 * 8. retorna resposta + citações.
 */
export class RagService {
  async retrieveChunks(params: {
    organizationId: string;
    query: string;
    caseId?: string | null;
    topK?: number;
  }): Promise<RetrievedChunk[]> {
    const embedding = await embeddingService.embedText(params.query);
    const vector = toVectorLiteral(embedding);
    const topK = params.topK ?? TOP_K;

    let rows: RawChunkRow[];
    if (params.caseId) {
      rows = await prisma.$queryRaw<RawChunkRow[]>`
        SELECT
          dc.id,
          dc."documentId" AS "documentId",
          d.title AS "documentTitle",
          dc.content,
          dc."pageNumber" AS "pageNumber",
          dc."chunkIndex" AS "chunkIndex",
          1 - (dc.embedding <=> ${vector}::vector) AS similarity
        FROM "DocumentChunk" dc
        JOIN "Document" d ON d.id = dc."documentId"
        WHERE dc."organizationId" = ${params.organizationId}
          AND dc.embedding IS NOT NULL
          AND d."caseId" = ${params.caseId}
        ORDER BY dc.embedding <=> ${vector}::vector
        LIMIT ${topK}
      `;
    } else {
      rows = await prisma.$queryRaw<RawChunkRow[]>`
        SELECT
          dc.id,
          dc."documentId" AS "documentId",
          d.title AS "documentTitle",
          dc.content,
          dc."pageNumber" AS "pageNumber",
          dc."chunkIndex" AS "chunkIndex",
          1 - (dc.embedding <=> ${vector}::vector) AS similarity
        FROM "DocumentChunk" dc
        JOIN "Document" d ON d.id = dc."documentId"
        WHERE dc."organizationId" = ${params.organizationId}
          AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> ${vector}::vector
        LIMIT ${topK}
      `;
    }

    return rows
      .filter((row) => Number(row.similarity) > 0)
      .map((row) => ({
        chunkId: row.id,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        content: row.content,
        pageNumber: row.pageNumber,
        chunkIndex: row.chunkIndex,
        similarity: Number(row.similarity),
      }));
  }

  async askQuestion(input: RagQuestionInput): Promise<RagQuestionResult> {
    // Garante que a conversa pertence à organização/usuário.
    let conversationId = input.conversationId ?? null;
    if (conversationId) {
      const existing = await prisma.aiConversation.findFirst({
        where: { id: conversationId, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!existing) conversationId = null;
    }

    if (!conversationId) {
      const conversation = await prisma.aiConversation.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          caseId: input.caseId ?? null,
          title: input.question.slice(0, 80),
        },
      });
      conversationId = conversation.id;
    }

    await prisma.aiMessage.create({
      data: {
        conversationId,
        role: "USER",
        content: input.question,
      },
    });

    const chunks = await this.retrieveChunks({
      organizationId: input.organizationId,
      query: input.question,
      caseId: input.caseId,
    });

    const provider = getAIProvider();
    const { text: answer, model } = await provider.generateText({
      system: SYSTEM_PROMPT,
      prompt: buildRagPrompt(input.question, chunks, input.structuredContext ?? undefined),
    });

    const citations = citationService.buildFromChunks(chunks);

    const assistantMessage = await prisma.aiMessage.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: answer,
        metadata: {
          model,
          retrievedChunks: chunks.length,
          caseId: input.caseId ?? null,
          inpiToolCalls: input.toolCalls ?? [],
        },
      },
    });

    await citationService.saveForMessage(assistantMessage.id, citations);

    await prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      conversationId,
      messageId: assistantMessage.id,
      answer,
      citations,
    };
  }
}

export const ragService = new RagService();
