import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { enqueueDocumentProcessing } from "@/lib/jobs/queues";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/** Dispara (ou repete) o processamento de um documento. */
export const POST = withApi<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { organizationId, userId } = await requireAuth();

  const document = await prisma.document.findFirst({
    where: { id, organizationId },
    select: { id: true, status: true },
  });
  if (!document) notFound("Documento");

  await prisma.document.update({
    where: { id },
    data: { status: "UPLOADED", errorMessage: null },
  });

  await enqueueDocumentProcessing(id);

  await logAudit({
    organizationId,
    userId,
    action: "document.reprocess",
    entityType: "Document",
    entityId: id,
  });

  return NextResponse.json({ ok: true, message: "Processamento iniciado." });
});
