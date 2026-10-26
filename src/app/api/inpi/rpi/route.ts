import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api-utils";

/** Lista as edições da RPI registradas na plataforma. */
export const GET = withApi(async () => {
  await requireAuth();

  const issues = await prisma.rpiIssue.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: {
      sections: {
        select: {
          id: true,
          sectionCode: true,
          name: true,
          status: true,
          pdfUrl: true,
          xmlUrl: true,
          txtUrl: true,
          _count: { select: { dispatches: true } },
        },
      },
    },
  });

  return NextResponse.json({ issues });
});
