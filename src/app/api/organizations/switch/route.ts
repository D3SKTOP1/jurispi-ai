import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth, unstable_update } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, parseBody, withApi } from "@/lib/api-utils";

const schema = z.object({ organizationId: z.string().min(1) });

/** Troca a organização ativa (só entre organizações das quais o usuário é membro). */
export const POST = withApi(async (req) => {
  const { userId } = await requireAuth();
  const { organizationId } = await parseBody(req, schema);

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { id: true },
  });
  if (!membership) throw new ApiError(403, "Você não pertence a essa organização.");

  // Dispara o trigger "update" do jwt, que revalida a membership e troca o token.
  await unstable_update({ organizationId } as never);

  return NextResponse.json({ ok: true, organizationId });
});
