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
    select: { id: true },
  });
  if (!document) notFound("Documento");

  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: id, organizationId },
    orderBy: { chunkIndex: "asc" },
    select: {
      id: true,
      chunkIndex: true,
      pageNumber: true,
      content: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ chunks });
});
