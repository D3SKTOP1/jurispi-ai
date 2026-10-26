import { NextResponse } from "next/server";
import type { AlertStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { assertCaseInOrg } from "@/lib/org-guard";
import { alertCreateSchema } from "@/lib/validators";

const STATUSES = ["OPEN", "RESOLVED", "DISMISSED"];

export const GET = withApi(async (req) => {
  const { organizationId } = await requireAuth();
  const statusParam = req.nextUrl.searchParams.get("status");
  const status = STATUSES.includes(statusParam ?? "") ? (statusParam as AlertStatus) : undefined;

  const alerts = await prisma.alert.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { case: { select: { id: true, title: true } } },
  });

  return NextResponse.json({ alerts });
});

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, alertCreateSchema);

  await assertCaseInOrg(data.caseId, organizationId);

  const alert = await prisma.alert.create({
    data: {
      organizationId,
      caseId: data.caseId ?? null,
      title: data.title,
      description: data.description ?? null,
      severity: data.severity ?? "INFO",
      dueDate: data.dueDate ?? null,
    },
  });

  await logAudit({
    organizationId,
    userId,
    action: "alert.created",
    entityType: "Alert",
    entityId: alert.id,
    metadata: { severity: alert.severity },
  });

  return NextResponse.json({ alert }, { status: 201 });
});
