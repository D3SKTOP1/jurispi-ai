import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, withApi } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { organizationId } = await requireAuth();

  const document = await prisma.document.findFirst({
    where: { id, organizationId },
    include: {
      client: { select: { id: true, name: true } },
      case: { select: { id: true, title: true } },
      _count: { select: { chunks: true, citations: true } },
    },
  });
  if (!document) notFound("Documento");

  return NextResponse.json({ document });
});
