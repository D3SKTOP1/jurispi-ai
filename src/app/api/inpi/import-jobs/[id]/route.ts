import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, withApi } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  await requireAuth();
  const { id } = await params;

  const job = await prisma.inpiImportJob.findUnique({
    where: { id },
    include: {
      source: true,
      rawFiles: {
        include: { _count: { select: { records: true } } },
      },
    },
  });
  if (!job) notFound("Job de importação");

  const logs = await prisma.inpiSyncLog.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ job, logs });
});
