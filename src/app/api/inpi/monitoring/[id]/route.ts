import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { monitoredProcessUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, monitoredProcessUpdateSchema);

  const existing = await prisma.monitoredProcess.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) notFound("Processo monitorado");

  const monitored = await prisma.monitoredProcess.update({
    where: { id },
    data: {
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.title !== undefined ? { title: data.title ?? null } : {}),
    },
  });

  await logAudit({
    organizationId,
    userId,
    action: "inpi.monitoring.updated",
    entityType: "MonitoredProcess",
    entityId: id,
    metadata: { isActive: monitored.isActive },
  });

  return NextResponse.json({ monitored });
});

export const DELETE = withApi<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { organizationId, userId } = await requireAuth();

  const existing = await prisma.monitoredProcess.findFirst({
    where: { id, organizationId },
    select: { id: true, processNumber: true },
  });
  if (!existing) notFound("Processo monitorado");

  await prisma.monitoredProcess.delete({ where: { id } });

  await logAudit({
    organizationId,
    userId,
    action: "inpi.monitoring.deleted",
    entityType: "MonitoredProcess",
    entityId: id,
    metadata: { processNumber: existing.processNumber },
  });

  return NextResponse.json({ ok: true });
});
