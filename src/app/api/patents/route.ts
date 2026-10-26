import { NextResponse } from "next/server";
import type { RiskLevel } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { assertClientInOrg } from "@/lib/org-guard";
import { patentCreateSchema, riskLevelEnum } from "@/lib/validators";

export const GET = withApi(async (req) => {
  const { organizationId } = await requireAuth();
  const sp = req.nextUrl.searchParams;

  const ipc = sp.get("ipc") ?? undefined;
  const status = sp.get("status") ?? undefined;
  const riskParam = sp.get("risk");
  const risk = riskLevelEnum.safeParse(riskParam).success
    ? (riskParam as RiskLevel)
    : undefined;

  const patents = await prisma.patentCase.findMany({
    where: {
      case: { organizationId, ...(risk ? { riskLevel: risk } : {}) },
      ...(ipc ? { ipcClasses: { has: ipc } } : {}),
      ...(status ? { currentStatus: { contains: status, mode: "insensitive" } } : {}),
    },
    orderBy: { title: "asc" },
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

  return NextResponse.json({ patents });
});

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, patentCreateSchema);

  await assertClientInOrg(data.clientId, organizationId);

  const created = await prisma.industrialPropertyCase.create({
    data: {
      organizationId,
      clientId: data.clientId ?? null,
      type: "PATENT",
      title: `Patente — ${data.title.slice(0, 250)}`,
      processNumber: data.processNumber ?? null,
      status: data.status ?? "EM_ANDAMENTO",
      riskLevel: data.riskLevel ?? "UNKNOWN",
      patent: {
        create: {
          title: data.title,
          abstract: data.abstract ?? null,
          ipcClasses: data.ipcClasses,
          inventors: data.inventors,
          applicants: data.applicants,
          filingDate: data.filingDate ?? null,
          publicationDate: data.publicationDate ?? null,
          grantDate: data.grantDate ?? null,
          expirationDate: data.expirationDate ?? null,
          currentStatus: data.currentStatus ?? null,
        },
      },
    },
    include: { patent: true },
  });

  await logAudit({
    organizationId,
    userId,
    action: "patent.created",
    entityType: "PatentCase",
    entityId: created.patent!.id,
    metadata: { title: data.title },
  });

  return NextResponse.json({ patent: created.patent, case: created }, { status: 201 });
});
