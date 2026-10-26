import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { generatedDocumentUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { organizationId } = await requireAuth();

  const document = await prisma.generatedDocument.findFirst({
    where: { id, organizationId },
    include: { case: { select: { id: true, title: true } } },
  });
  if (!document) notFound("Documento gerado");

  return NextResponse.json({ document });
});

export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { organizationId, userId } = await requireAuth();
  const data = await parseBody(req, generatedDocumentUpdateSchema);

  const existing = await prisma.generatedDocument.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) notFound("Documento gerado");

  const document = await prisma.generatedDocument.update({ where: { id }, data });

  await logAudit({
    organizationId,
    userId,
    action: "generated-document.updated",
    entityType: "GeneratedDocument",
    entityId: id,
    metadata: { status: document.status },
  });

  return NextResponse.json({ document });
});
