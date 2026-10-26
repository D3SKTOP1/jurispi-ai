import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { trademarkAnalysisService } from "@/lib/ai/trademark-analysis-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertCaseInOrg } from "@/lib/org-guard";
import { trademarkOpinionRequestSchema } from "@/lib/validators";

export const maxDuration = 60;

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`ai-generate:${userId}`, 10, 60_000);

  const data = await parseBody(req, trademarkOpinionRequestSchema);
  await assertCaseInOrg(data.caseId, organizationId);

  const result = await trademarkAnalysisService.generatePreliminaryOpinion({
    organizationId,
    userId,
    caseId: data.caseId ?? null,
    brandName: data.brandName,
    niceClasses: data.niceClasses,
    businessDescription: data.businessDescription,
    similarTrademarks: data.similarTrademarks,
    userNotes: data.userNotes,
  });

  return NextResponse.json(result, { status: 201 });
});
