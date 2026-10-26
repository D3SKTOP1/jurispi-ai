import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api-utils";

/** Histórico de jobs de importação (staging auditável). */
export const GET = withApi(async () => {
  await requireAuth();

  const jobs = await prisma.inpiImportJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      source: { select: { name: true, type: true } },
      rawFiles: { select: { id: true, fileName: true, checksum: true, sizeBytes: true } },
    },
  });

  return NextResponse.json({ jobs });
});
