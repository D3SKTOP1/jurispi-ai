import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { deadlineUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, deadlineUpdateSchema);

  const existing = await prisma.deadline.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) notFound("Prazo");

  const deadline = await prisma.deadline.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description ?? null } : {}),
      ...(data.dueDate !== undefined && data.dueDate ? { dueDate: data.dueDate } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  await logAudit({
    organizationId,
    userId,
    action: "deadline.updated",
    entityType: "Deadline",
    entityId: id,
    metadata: { status: deadline.status },
  });

  return NextResponse.json({ deadline });
});
