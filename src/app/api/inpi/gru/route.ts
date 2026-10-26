import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { gruService } from "@/lib/inpi/gru/gru-service";
import { withGruApi } from "@/lib/inpi/gru/gru-api-errors";
import { gruEmissionSchema } from "@/lib/validators";

/** Lista as GRUs registradas pela organização (leitura local). */
export const GET = withApi(async () => {
  const { organizationId } = await requireAuth();
  return NextResponse.json({ grus: await gruService.listGrus(organizationId) });
});

/**
 * ⚠️ EMITE uma GRU real no INPI (retribuição real; a guia só custa se for
 * paga). A UI confirma o valor via /preview antes de chamar aqui.
 */
export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`gru-emit:${userId}`, 5, 60_000);

  const data = await parseBody(req, gruEmissionSchema);
  const gru = await withGruApi(() => gruService.issueGru(organizationId, data));

  await logAudit({
    organizationId,
    userId,
    action: "inpi.gru.issue",
    entityType: "InpiGru",
    entityId: gru.id,
    metadata: {
      gruNumber: gru.gruNumber,
      serviceCode: gru.serviceCode,
      amountCents: gru.amountCents,
    },
  });

  return NextResponse.json({ gru }, { status: 201 });
});
