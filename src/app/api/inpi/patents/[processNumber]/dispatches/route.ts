import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { patentSearchService } from "@/lib/inpi/search/patent-search-service";

type Ctx = { params: Promise<{ processNumber: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  await requireAuth();
  const { processNumber } = await params;

  const dispatches = await patentSearchService.getDispatches(processNumber);
  return NextResponse.json({ dispatches });
});
