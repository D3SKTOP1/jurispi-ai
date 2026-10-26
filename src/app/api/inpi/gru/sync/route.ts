import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { gruService } from "@/lib/inpi/gru/gru-service";
import { withGruApi } from "@/lib/inpi/gru/gru-api-errors";
import { gruSyncSchema } from "@/lib/validators";

/**
 * Sincroniza as GRUs da conta e-INPI por período (padrão: últimos 90 dias).
 * Traz também guias emitidas fora do app (direto no portal do INPI).
 */
export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`gru-sync:${userId}`, 4, 60_000);

  const { days } = await parseBody(req, gruSyncSchema);
  const to = new Date();
  const from = new Date(to.getTime() - (days ?? 90) * 24 * 60 * 60 * 1000);
  const rows = await withGruApi(() => gruService.syncGrus(organizationId, { from, to }));
  return NextResponse.json({ found: rows.length, rows });
});
