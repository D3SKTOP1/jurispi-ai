import { requireAuth } from "@/lib/auth";
import { ApiError, withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { gruService } from "@/lib/inpi/gru/gru-service";
import { withGruApi } from "@/lib/inpi/gru/gru-api-errors";

/** 2ª via do boleto da GRU (PDF), baixada ao vivo do INPI. */
export const GET = withApi<{ params: Promise<{ gruNumber: string }> }>(async (_req, ctx) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`gru-boleto:${userId}`, 10, 60_000);

  const { gruNumber } = await ctx.params;
  if (!/^\d{5,20}$/.test(gruNumber)) throw new ApiError(400, "Número de GRU inválido.");

  const pdf = await withGruApi(() => gruService.getBoletoPdf(organizationId, gruNumber));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gru-${gruNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
