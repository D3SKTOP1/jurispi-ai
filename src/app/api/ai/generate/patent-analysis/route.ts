import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { patentAnalysisService } from "@/lib/ai/patent-analysis-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertCaseInOrg } from "@/lib/org-guard";
import { patentAnalysisRequestSchema } from "@/lib/validators";

export const maxDuration = 60;

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`ai-generate:${userId}`, 10, 60_000);

  const data = await parseBody(req, patentAnalysisRequestSchema);
  await assertCaseInOrg(data.caseId, organizationId);

  const result = await patentAnalysisService.generatePreliminaryAnalysis({
    organizationId,
    userId,
    caseId: data.caseId ?? null,
    title: data.title,
    abstract: data.abstract,
    keywords: data.keywords,
    ipcClasses: data.ipcClasses,
    priorArt: data.priorArt,
  });

  return NextResponse.json(result, { status: 201 });
});
