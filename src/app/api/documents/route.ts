import { NextResponse } from "next/server";
import type { DocumentStatus } from "@prisma/client";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api-utils";

const STATUSES = ["UPLOADED", "PROCESSING", "READY", "ERROR"];

export const GET = withApi(async (req) => {
  const { organizationId } = await requireAuth();
  const sp = req.nextUrl.searchParams;

  const caseId = sp.get("caseId") ?? undefined;
  const clientId = sp.get("clientId") ?? undefined;
  const statusParam = sp.get("status");
  const status = STATUSES.includes(statusParam ?? "")
    ? (statusParam as DocumentStatus)
    : undefined;

  const documents = await prisma.document.findMany({
    where: {
      organizationId,
      ...(caseId ? { caseId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      case: { select: { id: true, title: true } },
      _count: { select: { chunks: true } },
    },
  });

  return NextResponse.json({ documents });
});
