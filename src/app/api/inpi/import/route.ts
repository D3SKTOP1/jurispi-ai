import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { assertClientInOrg } from "@/lib/org-guard";
import { portfolioImportService } from "@/lib/inpi/import/portfolio-import-service";
import { portfolioImportSchema } from "@/lib/validators";

export const maxDuration = 60;

/** Importa em lote os processos selecionados (cria casos + monitoramento). */
export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  await enforceRateLimit(`import-run:${userId}`, 10, 60_000);

  const data = await parseBody(req, portfolioImportSchema);
  if (data.clientId) await assertClientInOrg(data.clientId, organizationId);

  const report = await portfolioImportService.import(
    organizationId,
    data.clientId ?? null,
    data.items.map((i) => ({
      processNumber: i.processNumber,
      type: i.type,
      title: i.title ?? "",
      niceClasses: i.niceClasses,
      holderName: i.holderName ?? null,
    }))
  );

  await logAudit({
    organizationId,
    userId,
    action: "inpi.portfolio.import",
    entityType: "IndustrialPropertyCase",
    metadata: { ...report, errors: report.errors.slice(0, 10) },
  });

  return NextResponse.json(report);
});
