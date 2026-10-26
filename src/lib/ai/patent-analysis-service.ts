import { prisma } from "@/lib/db";

import { citationService } from "./citation-service";
import { documentGenerationService } from "./document-generation-service";
import { buildPatentAnalysisPrompt } from "./prompts";
import { ragService } from "./rag-service";
import type { GeneratedAnalysisResult, PatentAnalysisInput } from "./types";

/**
 * PatentAnalysisService — gera a análise técnica preliminar de patente.
 * Recupera documentos relacionados e possíveis anterioridades via RAG,
 * salva a análise como GeneratedDocument e atualiza o caso de patente.
 */
export class PatentAnalysisService {
  async generatePreliminaryAnalysis(
    input: PatentAnalysisInput
  ): Promise<GeneratedAnalysisResult> {
    const query = [
      input.title,
      input.abstract ?? "",
      ...input.keywords,
      ...input.ipcClasses,
      "patente anterioridade estado da técnica",
    ].join(" ");

    const chunks = await ragService.retrieveChunks({
      organizationId: input.organizationId,
      query,
      caseId: input.caseId,
      topK: 6,
    });

    const prompt = buildPatentAnalysisPrompt(
      {
        title: input.title,
        abstract: input.abstract,
        keywords: input.keywords,
        ipcClasses: input.ipcClasses,
        priorArt: input.priorArt,
      },
      chunks
    );

    const document = await documentGenerationService.generate({
      organizationId: input.organizationId,
      userId: input.userId,
      caseId: input.caseId,
      type: "PATENT_ANALYSIS",
      title: `Análise preliminar de patente — ${input.title.slice(0, 100)}`,
      prompt,
    });

    if (input.caseId) {
      const patent = await prisma.patentCase.findFirst({
        where: { caseId: input.caseId, case: { organizationId: input.organizationId } },
        select: { id: true },
      });
      if (patent) {
        await prisma.patentCase.update({
          where: { id: patent.id },
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

export const patentAnalysisService = new PatentAnalysisService();
