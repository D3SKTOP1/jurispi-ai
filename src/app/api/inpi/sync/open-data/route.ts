import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enqueueInpiJob, INPI_QUEUES } from "@/lib/inpi/jobs/queues";

export const maxDuration = 60;

/**
 * Dispara a importação dos arquivos de DEMONSTRAÇÃO (fixtures) em
 * background — apenas dev/teste. Em produção a base é alimentada pela
 * RPI oficial (/api/inpi/rpi/discover + /api/inpi/rpi/sync).
 */
export const POST = withApi(async () => {
  const { organizationId, userId } = await requireRole(["ADMIN"]);
  await enforceRateLimit(`inpi-sync:${userId}`, 5, 60_000);

  if (process.env.INPI_ENABLE_FIXTURES !== "true") {
    return NextResponse.json(
      {
        error:
          "Importação de demonstração desabilitada. A base é alimentada pela RPI oficial — use “Atualizar base do INPI”.",
      },
      { status: 400 }
    );
  }

  await enqueueInpiJob(INPI_QUEUES.OPEN_DATA_SYNC, "syncOpenDataSources");

  await logAudit({
    organizationId,
    userId,
    action: "inpi.open-data.sync",
    entityType: "InpiImportJob",
  });

  return NextResponse.json({
    ok: true,
    message: "Sincronização de dados abertos iniciada em background.",
  });
});
