import { NextResponse } from "next/server";

import { withApi } from "@/lib/api-utils";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { liveMonitoringService } from "@/lib/inpi/monitoring/live-monitoring-service";

// Consulta ao vivo processo a processo — pode levar dezenas de segundos.
export const maxDuration = 60;

/**
 * Cron de monitoramento: verifica ao vivo no INPI os processos monitorados
 * e gera alertas + prazos nos despachos novos. Agendado no vercel.json.
 */
export const GET = withApi(async (req) => {
  assertCronAuthorized(req);
  const result = await liveMonitoringService.runScan();
  return NextResponse.json({ ok: true, ...result });
});
