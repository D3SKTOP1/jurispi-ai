import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { portfolioImportService } from "@/lib/inpi/import/portfolio-import-service";
import { portfolioSearchSchema } from "@/lib/validators";

// Busca ao vivo no INPI (titulares + patentes por depositante).
export const maxDuration = 60;

/** Passo 1 da importação: lista titulares (marcas) e patentes por depositante. */
export const POST = withApi(async (req) => {
  const { userId } = await requireAuth();
  await enforceRateLimit(`import-search:${userId}`, 15, 60_000);

  const { query } = await parseBody(req, portfolioSearchSchema);
  const result = await portfolioImportService.search(query);
  return NextResponse.json(result);
});
