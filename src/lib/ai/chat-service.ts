import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

import { ragService } from "./rag-service";
import type { RagQuestionInput, RagQuestionResult } from "./types";

/**
 * ChatService — orquestra o chat com IA (RAG + ferramentas internas do INPI)
 * e o histórico de conversas.
 *
 * Antes de responder, as ferramentas internas consultam a base estruturada
 * do INPI quando a pergunta envolve marcas, patentes, processos ou despachos;
 * o RAG cobre documentos e textos longos. A IA não inventa dados.
 */
export class ChatService {
  async sendMessage(input: RagQuestionInput): Promise<RagQuestionResult> {
    const { buildInpiToolContext } = await import("@/lib/inpi/ai-tools/inpi-ai-tools");
    const inpiContext = await buildInpiToolContext(input.question).catch((error) => {
      console.error("[ai] ferramentas INPI falharam (seguindo apenas com RAG):", error);
      return { context: "", toolCalls: [], usedInpiData: false };
    });

    const result = await ragService.askQuestion({
      ...input,
      structuredContext: inpiContext.usedInpiData ? inpiContext.context : null,
      toolCalls: inpiContext.toolCalls,
    });

    await logAudit({
      organizationId: input.organizationId,
      userId: input.userId,
      action: "ai.chat.message",
      entityType: "AiConversation",
      entityId: result.conversationId,
      metadata: {
        caseId: input.caseId ?? null,
        citations: result.citations.length,
        inpiToolCalls: inpiContext.toolCalls,
      },
    });

    return result;
  }

  async listConversations(organizationId: string, userId?: string) {
    return prisma.aiConversation.findMany({
      where: { organizationId, ...(userId ? { userId } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        case: { select: { id: true, title: true } },
        _count: { select: { messages: true } },
      },
    });
  }

  async getConversation(organizationId: string, conversationId: string) {
    return prisma.aiConversation.findFirst({
      where: { id: conversationId, organizationId },
      include: {
        case: { select: { id: true, title: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            citations: {
              select: {
                id: true,
                documentId: true,
                chunkId: true,
                sourceTitle: true,
                quote: true,
                pageNumber: true,
              },
            },
          },
        },
      },
    });
  }
}

export const chatService = new ChatService();
