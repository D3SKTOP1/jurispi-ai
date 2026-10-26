import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { liveInpiSearchService } from "@/lib/inpi/search/live-search-service";

// A busca textual de patentes no pePI é lenta em picos — margem de duração.
export const maxDuration = 60;

/**
 * Busca de patentes no INPI. Por padrão AO VIVO (pePI) com fallback à base
 * local; `live=0` força só a base local.
 */
export const GET = withApi(async (req) => {
  await requireAuth();
  const sp = req.nextUrl.searchParams;

  const query = sp.get("q")?.slice(0, 300) ?? undefined;
  const applicant = sp.get("applicant")?.slice(0, 200) ?? undefined;
  const inventor = sp.get("inventor")?.slice(0, 200) ?? undefined;
  const processNumber = sp.get("processNumber")?.slice(0, 30) ?? undefined;
  const hasCriteria = Boolean(query || applicant || inventor || processNumber);

  const limitParam = Number(sp.get("limit"));
  const { results, origin, degraded } = await liveInpiSearchService.searchPatents(
    {
      query,
      ipc: sp.get("ipc")?.slice(0, 30) ?? undefined,
      applicant,
      inventor,
      processNumber,
      status: sp.get("status")?.slice(0, 100) ?? undefined,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : undefined,
    },
    { live: hasCriteria && sp.get("live") !== "0" }
  );

  return NextResponse.json({ results, count: results.length, origin, degraded });
});
