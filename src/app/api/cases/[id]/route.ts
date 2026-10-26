import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { assertClientInOrg } from "@/lib/org-guard";
import { caseUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { organizationId } = await requireAuth();

  const found = await prisma.industrialPropertyCase.findFirst({
    where: { id, organizationId },
    include: {
      client: true,
      trademark: true,
      patent: true,
      industrialDesign: true,
      software: true,
      documents: { orderBy: { createdAt: "desc" } },
      alerts: { orderBy: { createdAt: "desc" } },
      deadlines: { orderBy: { dueDate: "asc" } },
      generatedDocuments: { orderBy: { createdAt: "desc" } },
      conversations: { orderBy: { updatedAt: "desc" }, take: 5 },
    },
  });
  if (!found) notFound("Processo");

  return NextResponse.json({ case: found });
});

export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, caseUpdateSchema);

  const existing = await prisma.industrialPropertyCase.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) notFound("Processo");

  if (data.clientId) await assertClientInOrg(data.clientId, organizationId);

  const updated = await prisma.industrialPropertyCase.update({
    where: { id },
    data: {
      ...(data.clientId !== undefined ? { clientId: data.clientId ?? null } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.processNumber !== undefined ? { processNumber: data.processNumber ?? null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.riskLevel !== undefined ? { riskLevel: data.riskLevel } : {}),
      ...(data.summary !== undefined ? { summary: data.summary ?? null } : {}),
      ...(data.nextStep !== undefined ? { nextStep: data.nextStep ?? null } : {}),
    },
  });

  await logAudit({
    organizationId,
    userId,
    action: "case.updated",
    entityType: "IndustrialPropertyCase",
    entityId: id,
  });

  return NextResponse.json({ case: updated });
});
