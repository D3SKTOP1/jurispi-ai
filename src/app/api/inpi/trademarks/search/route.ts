import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { liveInpiSearchService } from "@/lib/inpi/search/live-search-service";

// Busca de marca ao vivo pode passar pelo pePI (lento em picos).
export const maxDuration = 60;

/**
 * Busca de marcas no INPI. Por padrão consulta AO VIVO (pePI) e cai para a
 * base local se o INPI estiver indisponível — mesma lógica das telas.
 * `live=0` força só a base local. Disponível a qualquer usuário autenticado.
 */
export const GET = withApi(async (req) => {
  await requireAuth();
  const sp = req.nextUrl.searchParams;

  const mode = ["exact", "similar", "prefix"].includes(sp.get("mode") ?? "")
    ? (sp.get("mode") as "exact" | "similar" | "prefix")
    : "similar";

  const query = sp.get("q")?.slice(0, 200) ?? undefined;
  const holder = sp.get("holder")?.slice(0, 200) ?? undefined;
  const processNumber = sp.get("processNumber")?.slice(0, 30) ?? undefined;
  const hasCriteria = Boolean(query || holder || processNumber);

  const limitParam = Number(sp.get("limit"));
  const { results, origin, degraded } = await liveInpiSearchService.searchTrademarks(
    {
      query,
      niceClass: sp.get("niceClass")?.slice(0, 5) ?? undefined,
      holder,
      processNumber,
      status: sp.get("status")?.slice(0, 100) ?? undefined,
      mode,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : undefined,
    },
    { live: hasCriteria && sp.get("live") !== "0" }
  );

  return NextResponse.json({ results, count: results.length, origin, degraded });
});
