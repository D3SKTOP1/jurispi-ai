import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { liveMonitoringService } from "@/lib/inpi/monitoring/live-monitoring-service";

// Verifica ao vivo os processos da organização — pode levar dezenas de segundos.
export const maxDuration = 60;

/** Verificação manual (sob demanda) do monitoramento da organização atual. */
export const POST = withApi(async () => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`inpi-monitor-check:${userId}`, 4, 60_000);

  const result = await liveMonitoringService.runScan({ organizationId });

  await logAudit({
    organizationId,
    userId,
    action: "inpi.monitoring.check",
    entityType: "MonitoredProcess",
    metadata: { ...result },
  });

  return NextResponse.json({ ok: true, ...result });
});
