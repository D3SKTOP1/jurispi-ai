import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { notFound, withApi } from "@/lib/api-utils";
import { patentSearchService } from "@/lib/inpi/search/patent-search-service";

type Ctx = { params: Promise<{ processNumber: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  await requireAuth();
  const { processNumber } = await params;

  const patent = await patentSearchService.searchPatentByProcessNumber(processNumber);
  if (!patent) notFound("Patente");

  return NextResponse.json({ patent });
});
