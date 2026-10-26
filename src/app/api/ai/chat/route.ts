import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { chatService } from "@/lib/ai/chat-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertCaseInOrg } from "@/lib/org-guard";
import { chatRequestSchema } from "@/lib/validators";

// Vercel: RAG + ferramentas INPI + geração podem passar do timeout default.
export const maxDuration = 60;

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`ai-chat:${userId}`, 20, 60_000);

  const data = await parseBody(req, chatRequestSchema);
  await assertCaseInOrg(data.caseId, organizationId);

  const result = await chatService.sendMessage({
    organizationId,
    userId,
    caseId: data.caseId ?? null,
    conversationId: data.conversationId ?? null,
    question: data.message,
  });

  return NextResponse.json(result);
});
