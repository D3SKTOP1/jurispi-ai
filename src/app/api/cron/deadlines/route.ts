import { NextResponse } from "next/server";

import { withApi } from "@/lib/api-utils";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { runDeadlineScan } from "@/lib/jobs/alert-job";
import { cleanupRateLimits } from "@/lib/rate-limit";

/**
 * Cron diário: marca prazos vencidos (alerta crítico), avisa os que vencem
 * nos próximos dias (com e-mail) e faz manutenção leve (janelas de rate
 * limit antigas). Agendado no vercel.json.
 */
export const GET = withApi(async (req) => {
  assertCronAuthorized(req);
  const result = await runDeadlineScan();
  const rateLimitsCleaned = await cleanupRateLimits().catch(() => 0);
  return NextResponse.json({ ok: true, ...result, rateLimitsCleaned });
});
