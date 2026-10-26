import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { alertUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, alertUpdateSchema);

  const existing = await prisma.alert.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) notFound("Alerta");

  const alert = await prisma.alert.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.severity !== undefined ? { severity: data.severity } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ?? null } : {}),
    },
  });

  await logAudit({
    organizationId,
    userId,
    action: "alert.updated",
    entityType: "Alert",
    entityId: id,
    metadata: { status: alert.status },
  });

  return NextResponse.json({ alert });
});
