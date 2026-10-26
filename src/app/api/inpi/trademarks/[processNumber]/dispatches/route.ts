import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { trademarkSearchService } from "@/lib/inpi/search/trademark-search-service";

type Ctx = { params: Promise<{ processNumber: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  await requireAuth();
  const { processNumber } = await params;

  const dispatches = await trademarkSearchService.getDispatches(processNumber);
  return NextResponse.json({ dispatches });
});
