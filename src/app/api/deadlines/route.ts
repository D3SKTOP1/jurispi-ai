import { NextResponse } from "next/server";
import type { DeadlineStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { assertCaseInOrg } from "@/lib/org-guard";
import { deadlineCreateSchema } from "@/lib/validators";

const STATUSES = ["PENDING", "DONE", "OVERDUE"];

export const GET = withApi(async (req) => {
  const { organizationId } = await requireAuth();
  const statusParam = req.nextUrl.searchParams.get("status");
  const status = STATUSES.includes(statusParam ?? "")
    ? (statusParam as DeadlineStatus)
    : undefined;

  const deadlines = await prisma.deadline.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    orderBy: { dueDate: "asc" },
    include: { case: { select: { id: true, title: true } } },
  });

  return NextResponse.json({ deadlines });
});

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, deadlineCreateSchema);

  await assertCaseInOrg(data.caseId, organizationId);

  const deadline = await prisma.deadline.create({
    data: {
      organizationId,
      caseId: data.caseId ?? null,
      title: data.title,
      description: data.description ?? null,
      dueDate: data.dueDate,
    },
  });

  await logAudit({
    organizationId,
    userId,
    action: "deadline.created",
    entityType: "Deadline",
    entityId: deadline.id,
    metadata: { dueDate: deadline.dueDate.toISOString() },
  });

  return NextResponse.json({ deadline }, { status: 201 });
});
