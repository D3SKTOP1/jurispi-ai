import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, withApi } from "@/lib/api-utils";

type Ctx = { params: Promise<{ number: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  await requireAuth();
  const { number } = await params;

  const issue = await prisma.rpiIssue.findUnique({
    where: { number },
    include: {
      sections: {
        include: {
          dispatches: {
            orderBy: { createdAt: "desc" },
            take: 200,
          },
        },
      },
    },
  });
  if (!issue) notFound("Edição da RPI");

  return NextResponse.json({ issue });
});
