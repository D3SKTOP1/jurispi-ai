import { NextResponse } from "next/server";
import type { CaseType, RiskLevel } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { assertClientInOrg } from "@/lib/org-guard";
import { caseCreateSchema, caseTypeEnum, riskLevelEnum } from "@/lib/validators";

export const GET = withApi(async (req) => {
  const { organizationId } = await requireAuth();
  const sp = req.nextUrl.searchParams;

  const clientId = sp.get("clientId") ?? undefined;
  const typeParam = sp.get("type");
  const riskParam = sp.get("riskLevel");
  const status = sp.get("status") ?? undefined;

  const type = caseTypeEnum.safeParse(typeParam).success
    ? (typeParam as CaseType)
    : undefined;
  const riskLevel = riskLevelEnum.safeParse(riskParam).success
    ? (riskParam as RiskLevel)
    : undefined;

  const cases = await prisma.industrialPropertyCase.findMany({
    where: {
      organizationId,
      ...(clientId ? { clientId } : {}),
      ...(type ? { type } : {}),
      ...(riskLevel ? { riskLevel } : {}),
      ...(status ? { status: { contains: status, mode: "insensitive" } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      trademark: { select: { id: true, brandName: true } },
      patent: { select: { id: true, title: true } },
      _count: { select: { documents: true, alerts: true, deadlines: true } },
    },
  });

  return NextResponse.json({ cases });
});

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, caseCreateSchema);

  await assertClientInOrg(data.clientId, organizationId);

  const created = await prisma.industrialPropertyCase.create({
    data: {
      organizationId,
      clientId: data.clientId ?? null,
      type: data.type,
      title: data.title,
      processNumber: data.processNumber ?? null,
      status: data.status ?? "EM_ANDAMENTO",
      riskLevel: data.riskLevel ?? "UNKNOWN",
      summary: data.summary ?? null,
      nextStep: data.nextStep ?? null,
      // Cria o registro específico do tipo junto com o processo.
      ...(data.type === "TRADEMARK"
        ? { trademark: { create: { brandName: data.title } } }
        : {}),
      ...(data.type === "PATENT" ? { patent: { create: { title: data.title } } } : {}),
      ...(data.type === "INDUSTRIAL_DESIGN"
        ? { industrialDesign: { create: { title: data.title } } }
        : {}),
      ...(data.type === "SOFTWARE"
        ? { software: { create: { programTitle: data.title } } }
        : {}),
    },
    include: { trademark: true, patent: true },
  });

  await logAudit({
    organizationId,
    userId,
    action: "case.created",
    entityType: "IndustrialPropertyCase",
    entityId: created.id,
    metadata: { type: created.type, title: created.title },
  });

  return NextResponse.json({ case: created }, { status: 201 });
});
