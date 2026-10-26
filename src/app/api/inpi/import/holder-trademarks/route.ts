import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { portfolioImportService } from "@/lib/inpi/import/portfolio-import-service";
import { portfolioHolderSchema } from "@/lib/validators";

export const maxDuration = 60;

/** Passo 2: marcas de um titular específico (por posição). */
export const POST = withApi(async (req) => {
  const { userId } = await requireAuth();
  await enforceRateLimit(`import-holder:${userId}`, 30, 60_000);

  const { query, pos } = await parseBody(req, portfolioHolderSchema);
  const trademarks = await portfolioImportService.listHolderTrademarks(query, pos);
  return NextResponse.json({ trademarks });
});
