import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { gruService } from "@/lib/inpi/gru/gru-service";
import { withGruApi } from "@/lib/inpi/gru/gru-api-errors";
import { gruEmissionSchema } from "@/lib/validators";

/** Preview do valor da GRU no INPI — não gera guia nem cobra nada. */
export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`gru-preview:${userId}`, 10, 60_000);

  const data = await parseBody(req, gruEmissionSchema);
  return withGruApi(async () => NextResponse.json(await gruService.preview(organizationId, data)));
});
