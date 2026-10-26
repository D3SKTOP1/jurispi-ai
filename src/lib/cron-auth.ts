import { NextRequest } from "next/server";

import { ApiError } from "@/lib/api-utils";

/**
 * Autoriza uma rota de cron. Aceita:
 * - requisições do Vercel Cron (header `x-vercel-cron`);
 * - `Authorization: Bearer <CRON_SECRET>` (para disparo manual/externo).
 *
 * Se `CRON_SECRET` não estiver definido, só o header do Vercel é aceito
 * (evita rota aberta por engano em produção).
 */
export function assertCronAuthorized(req: NextRequest): void {
  if (req.headers.get("x-vercel-cron")) return;

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return;
  }
  throw new ApiError(401, "Cron não autorizado.");
}
