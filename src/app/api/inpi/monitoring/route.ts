import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { assertCaseInOrg, assertClientInOrg } from "@/lib/org-guard";
import { monitorProcessTool } from "@/lib/inpi/ai-tools/inpi-ai-tools";
import { normalizeProcessNumber } from "@/lib/inpi/normalizers/text-normalizer";
import { monitoredProcessCreateSchema } from "@/lib/validators";

/** Processos monitorados da organização (tenant-specific). */
export const GET = withApi(async () => {
  const { organizationId } = await requireAuth();

  const monitored = await prisma.monitoredProcess.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      case: { select: { id: true, title: true } },
    },
  });

  // Último despacho publicado por processo (base global RPI).
  const processNumbers = monitored.map((m) => m.processNumber);
  const lastDispatches = await prisma.rpiDispatch.findMany({
    where: { processNumber: { in: processNumbers } },
    orderBy: { createdAt: "desc" },
    include: { rpiSection: { include: { rpiIssue: { select: { number: true, publishedAt: true } } } } },
  });
  const lastByProcess = new Map<string, (typeof lastDispatches)[number]>();
  for (const d of lastDispatches) {
    if (!lastByProcess.has(d.processNumber)) lastByProcess.set(d.processNumber, d);
  }

  return NextResponse.json({
    monitored: monitored.map((m) => ({
      ...m,
      lastDispatch: lastByProcess.get(m.processNumber)
        ? {
            dispatchText: lastByProcess.get(m.processNumber)!.dispatchText,
            dispatchCode: lastByProcess.get(m.processNumber)!.dispatchCode,
            rpiNumber: lastByProcess.get(m.processNumber)!.rpiSection.rpiIssue.number,
            rpiDate: lastByProcess.get(m.processNumber)!.rpiSection.rpiIssue.publishedAt,
          }
        : null,
    })),
  });
});

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, monitoredProcessCreateSchema);

  await assertClientInOrg(data.clientId, organizationId);
  await assertCaseInOrg(data.caseId, organizationId);

  const monitored = await monitorProcessTool({
    organizationId,
    processNumber: normalizeProcessNumber(data.processNumber),
    type: data.type,
    title: data.title,
    clientId: data.clientId ?? null,
    caseId: data.caseId ?? null,
  });

  await logAudit({
    organizationId,
    userId,
    action: "inpi.monitoring.created",
    entityType: "MonitoredProcess",
    entityId: monitored.id,
    metadata: { processNumber: monitored.processNumber, type: monitored.type },
  });

  return NextResponse.json({ monitored }, { status: 201 });
});
