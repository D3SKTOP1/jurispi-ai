import { prisma } from "@/lib/db";

import { citationService } from "./citation-service";
import { documentGenerationService } from "./document-generation-service";
import { buildTrademarkOpinionPrompt } from "./prompts";
import { ragService } from "./rag-service";
import type { GeneratedAnalysisResult, TrademarkAnalysisInput } from "./types";

/**
 * TrademarkAnalysisService — gera o parecer preliminar de viabilidade de marca.
 * Recupera documentos de apoio via RAG, monta o prompt estruturado,
 * salva o parecer como GeneratedDocument e atualiza o caso de marca.
 */
export class TrademarkAnalysisService {
  async generatePreliminaryOpinion(
    input: TrademarkAnalysisInput
  ): Promise<GeneratedAnalysisResult> {
    const query = [
      input.brandName,
      ...input.niceClasses.map((c) => `classe ${c}`),
      input.businessDescription ?? "",
      "marca registro INPI colidência",
    ].join(" ");

    const chunks = await ragService.retrieveChunks({
      organizationId: input.organizationId,
      query,
      caseId: input.caseId,
      topK: 6,
    });

    const prompt = buildTrademarkOpinionPrompt(
      {
        brandName: input.brandName,
        niceClasses: input.niceClasses,
        businessDescription: input.businessDescription,
        similarTrademarks: input.similarTrademarks,
        userNotes: input.userNotes,
      },
      chunks
    );

    const document = await documentGenerationService.generate({
      organizationId: input.organizationId,
      userId: input.userId,
      caseId: input.caseId,
      type: "PRELIMINARY_OPINION",
      title: `Parecer preliminar de marca — ${input.brandName}`,
      prompt,
    });

    // Salva a análise no caso de marca vinculado, quando houver.
    if (input.caseId) {
      const trademark = await prisma.trademarkCase.findFirst({
        where: { caseId: input.caseId, case: { organizationId: input.organizationId } },
        select: { id: true },
      });
      if (trademark) {
        await prisma.trademarkCase.update({
          where: { id: trademark.id },
          data: { aiAnalysis: document.content },
        });
      }
    }

    return {
      generatedDocumentId: document.id,
      title: document.title,
      content: document.content,
      citations: citationService.buildFromChunks(chunks),
    };
  }
}

export const trademarkAnalysisService = new TrademarkAnalysisService();
