import { NextResponse } from "next/server";
import type { RiskLevel } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { assertClientInOrg } from "@/lib/org-guard";
import { riskLevelEnum, trademarkCreateSchema } from "@/lib/validators";

export const GET = withApi(async (req) => {
  const { organizationId } = await requireAuth();
  const sp = req.nextUrl.searchParams;

  const niceClass = sp.get("niceClass") ?? undefined;
  const status = sp.get("status") ?? undefined;
  const riskParam = sp.get("risk");
  const risk = riskLevelEnum.safeParse(riskParam).success
    ? (riskParam as RiskLevel)
    : undefined;

  const trademarks = await prisma.trademarkCase.findMany({
    where: {
      case: { organizationId },
      ...(niceClass ? { niceClasses: { has: niceClass } } : {}),
      ...(status ? { currentStatus: { contains: status, mode: "insensitive" } } : {}),
      ...(risk ? { collisionRisk: risk } : {}),
    },
    orderBy: { brandName: "asc" },
    include: {
      case: {
        select: {
          id: true,
          title: true,
          processNumber: true,
          status: true,
          riskLevel: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({ trademarks });
});

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, trademarkCreateSchema);

  await assertClientInOrg(data.clientId, organizationId);

  const created = await prisma.industrialPropertyCase.create({
    data: {
      organizationId,
      clientId: data.clientId ?? null,
      type: "TRADEMARK",
      title: data.title ?? `Marca — ${data.brandName}`,
      processNumber: data.processNumber ?? null,
      status: data.status ?? "EM_ANDAMENTO",
      riskLevel: data.riskLevel ?? data.collisionRisk ?? "UNKNOWN",
      trademark: {
        create: {
          brandName: data.brandName,
          niceClasses: data.niceClasses,
          presentationType: data.presentationType ?? null,
          nature: data.nature ?? null,
          holderName: data.holderName ?? null,
          applicationDate: data.applicationDate ?? null,
          currentStatus: data.currentStatus ?? null,
          collisionRisk: data.collisionRisk ?? "UNKNOWN",
        },
      },
    },
    include: { trademark: true },
  });

  await logAudit({
    organizationId,
    userId,
    action: "trademark.created",
    entityType: "TrademarkCase",
    entityId: created.trademark!.id,
    metadata: { brandName: data.brandName },
  });

  return NextResponse.json({ trademark: created.trademark, case: created }, { status: 201 });
});
