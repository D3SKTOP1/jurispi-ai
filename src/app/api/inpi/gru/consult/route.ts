import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { gruService } from "@/lib/inpi/gru/gru-service";
import { withGruApi } from "@/lib/inpi/gru/gru-api-errors";
import { gruConsultSchema } from "@/lib/validators";

/** Consulta a situação de uma GRU no INPI e atualiza o registro local. */
export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`gru-consult:${userId}`, 10, 60_000);

  const { gruNumber } = await parseBody(req, gruConsultSchema);
  const status = await withGruApi(() => gruService.consultGru(organizationId, gruNumber));
  return NextResponse.json({ status });
});
