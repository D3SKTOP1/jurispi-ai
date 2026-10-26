import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { clientCreateSchema } from "@/lib/validators";

export const GET = withApi(async (req) => {
  const { organizationId } = await requireAuth();
  const query = req.nextUrl.searchParams.get("query")?.trim();

  const clients = await prisma.client.findMany({
    where: {
      organizationId,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { cases: true, documents: true } } },
  });

  return NextResponse.json({ clients });
});

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, clientCreateSchema);

  const client = await prisma.client.create({
    data: { ...data, organizationId },
  });

  await logAudit({
    organizationId,
    userId,
    action: "client.created",
    entityType: "Client",
    entityId: client.id,
    metadata: { name: client.name },
  });

  return NextResponse.json({ client }, { status: 201 });
});
