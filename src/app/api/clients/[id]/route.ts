import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { clientUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { organizationId } = await requireAuth();

  const client = await prisma.client.findFirst({
    where: { id, organizationId },
    include: {
      cases: {
        orderBy: { updatedAt: "desc" },
        include: { trademark: true, patent: true },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) notFound("Cliente");

  return NextResponse.json({ client });
});

export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, clientUpdateSchema);

  const existing = await prisma.client.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) notFound("Cliente");

  const client = await prisma.client.update({ where: { id }, data });

  await logAudit({
    organizationId,
    userId,
    action: "client.updated",
    entityType: "Client",
    entityId: id,
  });

  return NextResponse.json({ client });
});
