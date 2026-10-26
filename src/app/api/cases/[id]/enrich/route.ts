import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { enrichCaseFromInpi } from "@/lib/inpi/case-enrichment-service";

// Consulta ao vivo no INPI para sincronizar o caso.
export const maxDuration = 60;

/** Sincroniza um caso do escritório com o registro oficial do INPI (ao vivo). */
export const POST = withApi(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`case-enrich:${userId}`, 10, 60_000);

  const { id } = await ctx.params;
  const result = await enrichCaseFromInpi(id, organizationId);

  await logAudit({
    organizationId,
    userId,
    action: "case.enrich-from-inpi",
    entityType: "IndustrialPropertyCase",
    entityId: id,
    metadata: { enriched: result.enriched, origin: result.origin ?? null },
  });

  return NextResponse.json(result);
});
