import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { inpiMonitoringService } from "@/lib/inpi/monitoring/inpi-monitoring-service";

export const maxDuration = 60;

/**
 * Consulta o índice oficial da RPI (revistas.inpi.gov.br), registra as
 * edições ainda não conhecidas e devolve a lista de edições pendentes de
 * sincronização — o cliente encadeia chamadas a /api/inpi/rpi/sync.
 */
export const POST = withApi(async () => {
  const { organizationId, userId } = await requireRole(["ADMIN"]);
  await enforceRateLimit(`inpi-discover:${userId}`, 10, 60_000);

  const { discovered, latestAvailable } =
    await inpiMonitoringService.discoverLatestRpiIssues();

  const pending = await prisma.rpiIssue.findMany({
    where: { status: { in: ["DISCOVERED", "PROCESSING"] } },
    orderBy: { number: "asc" },
    select: { number: true, publishedAt: true, status: true },
  });

  await logAudit({
    organizationId,
    userId,
    action: "inpi.rpi.discover",
    entityType: "RpiIssue",
    metadata: { discovered, latestAvailable: latestAvailable ?? null },
  });

  return NextResponse.json({
    ok: true,
    discovered,
    latestAvailable: latestAvailable ?? null,
    pending,
    message:
      discovered.length > 0
        ? `${discovered.length} edição(ões) nova(s) encontrada(s): ${discovered.join(", ")}.`
        : "Nenhuma edição nova no INPI.",
  });
});
