import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { patentUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { organizationId } = await requireAuth();

  const patent = await prisma.patentCase.findFirst({
    where: { id, case: { organizationId } },
    include: {
      case: {
        include: {
          client: { select: { id: true, name: true } },
          documents: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
  if (!patent) notFound("Patente");

  return NextResponse.json({ patent });
});

export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, patentUpdateSchema);

  const existing = await prisma.patentCase.findFirst({
    where: { id, case: { organizationId } },
    select: { id: true, caseId: true },
  });
  if (!existing) notFound("Patente");

  const patent = await prisma.patentCase.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.abstract !== undefined ? { abstract: data.abstract ?? null } : {}),
      ...(data.ipcClasses !== undefined ? { ipcClasses: data.ipcClasses } : {}),
      ...(data.inventors !== undefined ? { inventors: data.inventors } : {}),
      ...(data.applicants !== undefined ? { applicants: data.applicants } : {}),
      ...(data.filingDate !== undefined ? { filingDate: data.filingDate ?? null } : {}),
      ...(data.publicationDate !== undefined
        ? { publicationDate: data.publicationDate ?? null }
        : {}),
      ...(data.grantDate !== undefined ? { grantDate: data.grantDate ?? null } : {}),
      ...(data.expirationDate !== undefined
        ? { expirationDate: data.expirationDate ?? null }
        : {}),
      ...(data.currentStatus !== undefined ? { currentStatus: data.currentStatus ?? null } : {}),
      ...(data.aiAnalysis !== undefined ? { aiAnalysis: data.aiAnalysis ?? null } : {}),
    },
  });

  if (data.processNumber !== undefined || data.status !== undefined || data.riskLevel !== undefined) {
    await prisma.industrialPropertyCase.update({
      where: { id: existing.caseId },
      data: {
        ...(data.processNumber !== undefined ? { processNumber: data.processNumber ?? null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.riskLevel !== undefined ? { riskLevel: data.riskLevel } : {}),
      },
    });
  }

  await logAudit({
    organizationId,
    userId,
    action: "patent.updated",
    entityType: "PatentCase",
    entityId: id,
  });

  return NextResponse.json({ patent });
});
