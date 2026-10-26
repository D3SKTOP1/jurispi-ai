import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { trademarkSearchService } from "@/lib/inpi/search/trademark-search-service";
import { trademarkRiskRequestSchema } from "@/lib/validators";

/** Análise preliminar de risco de colisão sobre a base global do INPI. */
export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`inpi-risk:${userId}`, 15, 60_000);

  const data = await parseBody(req, trademarkRiskRequestSchema);

  const result = await trademarkSearchService.analyzeTrademarkRisk({
    brandName: data.brandName,
    niceClasses: data.niceClasses,
  });

  await logAudit({
    organizationId,
    userId,
    action: "inpi.trademark.risk-analysis",
    entityType: "InpiTrademark",
    metadata: {
      brandName: data.brandName,
      niceClasses: data.niceClasses,
      riskLevel: result.riskLevel,
      score: result.score,
    },
  });

  return NextResponse.json(result);
});
