import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { gruService } from "@/lib/inpi/gru/gru-service";
import { withGruApi } from "@/lib/inpi/gru/gru-api-errors";

/**
 * Catálogo progressivo do assistente de emissão (cada chamada = 1 login no
 * portal do INPI):
 * - sem query           → diretorias ("tipos de serviço")
 * - ?diretoria=300      → serviços da diretoria
 * - ?diretoria&servico  → campos exigidos + opções dos selects do serviço
 */
export const GET = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`gru-catalog:${userId}`, 20, 60_000);

  const url = new URL(req.url);
  const diretoria = url.searchParams.get("diretoria")?.trim();
  const servico = url.searchParams.get("servico")?.trim();

  return withGruApi(async () => {
    if (diretoria && servico) {
      return NextResponse.json(await gruService.getServiceDetail(organizationId, diretoria, servico));
    }
    if (diretoria) {
      return NextResponse.json({ services: await gruService.getServices(organizationId, diretoria) });
    }
    return NextResponse.json({ types: await gruService.getServiceTypes(organizationId) });
  });
});
