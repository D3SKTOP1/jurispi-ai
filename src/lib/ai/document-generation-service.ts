import type { GeneratedDocumentType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

import { getAIProvider } from "./ai-provider";
import { SYSTEM_PROMPT } from "./prompts";

interface GenerateDocumentInput {
  organizationId: string;
  userId: string;
  caseId?: string | null;
  type: GeneratedDocumentType;
  title: string;
  prompt: string;
}

/**
 * DocumentGenerationService — gera documentos assistidos por IA
 * (pareceres, análises, relatórios, rascunhos) e os persiste como DRAFT.
 */
export class DocumentGenerationService {
  async generate(input: GenerateDocumentInput) {
    const provider = getAIProvider();
    const { text, model } = await provider.generateText({
      system: SYSTEM_PROMPT,
      prompt: input.prompt,
      maxTokens: 4096,
    });

    const document = await prisma.generatedDocument.create({
      data: {
        organizationId: input.organizationId,
        caseId: input.caseId ?? null,
        type: input.type,
        title: input.title,
        content: text,
        status: "DRAFT",
      },
    });

    await logAudit({
      organizationId: input.organizationId,
      userId: input.userId,
      action: "ai.document.generated",
      entityType: "GeneratedDocument",
      entityId: document.id,
      metadata: { type: input.type, model, caseId: input.caseId ?? null },
    });

    return document;
  }
}

export const documentGenerationService = new DocumentGenerationService();
