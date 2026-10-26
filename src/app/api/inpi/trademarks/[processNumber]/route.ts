import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { notFound, withApi } from "@/lib/api-utils";
import { trademarkSearchService } from "@/lib/inpi/search/trademark-search-service";

type Ctx = { params: Promise<{ processNumber: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  await requireAuth();
  const { processNumber } = await params;

  const trademark = await trademarkSearchService.searchTrademarkByProcessNumber(processNumber);
  if (!trademark) notFound("Marca");

  return NextResponse.json({ trademark });
});
