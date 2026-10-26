import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { trademarkUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { organizationId } = await requireAuth();

  const trademark = await prisma.trademarkCase.findFirst({
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
  if (!trademark) notFound("Marca");

  return NextResponse.json({ trademark });
});

export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, trademarkUpdateSchema);

  const existing = await prisma.trademarkCase.findFirst({
    where: { id, case: { organizationId } },
    select: { id: true, caseId: true },
  });
  if (!existing) notFound("Marca");

  const trademark = await prisma.trademarkCase.update({
    where: { id },
    data: {
      ...(data.brandName !== undefined ? { brandName: data.brandName } : {}),
      ...(data.niceClasses !== undefined ? { niceClasses: data.niceClasses } : {}),
      ...(data.presentationType !== undefined
        ? { presentationType: data.presentationType ?? null }
        : {}),
      ...(data.nature !== undefined ? { nature: data.nature ?? null } : {}),
      ...(data.holderName !== undefined ? { holderName: data.holderName ?? null } : {}),
      ...(data.applicationDate !== undefined
        ? { applicationDate: data.applicationDate ?? null }
        : {}),
      ...(data.currentStatus !== undefined ? { currentStatus: data.currentStatus ?? null } : {}),
      ...(data.collisionRisk !== undefined ? { collisionRisk: data.collisionRisk } : {}),
      ...(data.aiAnalysis !== undefined ? { aiAnalysis: data.aiAnalysis ?? null } : {}),
    },
  });

  // Campos do processo pai, quando enviados.
  if (
    data.processNumber !== undefined ||
    data.status !== undefined ||
    data.riskLevel !== undefined ||
    data.title !== undefined
  ) {
    await prisma.industrialPropertyCase.update({
      where: { id: existing.caseId },
      data: {
        ...(data.processNumber !== undefined ? { processNumber: data.processNumber ?? null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.riskLevel !== undefined ? { riskLevel: data.riskLevel } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
      },
    });
  }

  await logAudit({
    organizationId,
    userId,
    action: "trademark.updated",
    entityType: "TrademarkCase",
    entityId: id,
  });

  return NextResponse.json({ trademark });
});
