import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api-utils";

export const GET = withApi(async (req) => {
  const { organizationId } = await requireAuth();
  const caseId = req.nextUrl.searchParams.get("caseId") ?? undefined;

  const documents = await prisma.generatedDocument.findMany({
    where: { organizationId, ...(caseId ? { caseId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { case: { select: { id: true, title: true } } },
  });

  return NextResponse.json({ documents });
});
