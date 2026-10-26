import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { syncRealRpiSlice } from "@/lib/inpi/rpi-ingest";
import { rpiSyncRequestSchema } from "@/lib/validators";

export const maxDuration = 60;

/**
 * Processa a PRÓXIMA FATIA pendente de uma edição da RPI e devolve o
 * progresso. Uma edição real de marcas tem ~40 mil registros — não cabe
 * em uma invocação serverless; o cliente chama em loop até `done: true`.
 * Idempotente: o estado de retomada fica no metadata da edição.
 */
export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireRole(["ADMIN"]);
  // Uma edição completa consome ~12 fatias; o limite cobre a atualização
  // de várias edições em sequência sem abrir a porta para abuso.
  await enforceRateLimit(`inpi-sync:${userId}`, 120, 60_000);

  const data = await parseBody(req, rpiSyncRequestSchema);
  if (!data.rpiNumber) {
    return NextResponse.json(
      { error: "Informe o número da edição da RPI (rpiNumber)." },
      { status: 400 }
    );
  }

  const progress = await syncRealRpiSlice(data.rpiNumber);

  // Audita apenas o fechamento da edição (não cada fatia).
  if (progress.done) {
    await logAudit({
      organizationId,
      userId,
      action: "inpi.rpi.sync",
      entityType: "RpiIssue",
      metadata: { rpiNumber: data.rpiNumber },
    });
  }

  return NextResponse.json(progress);
});
