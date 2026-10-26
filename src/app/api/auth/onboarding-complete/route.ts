import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withApi } from "@/lib/api-utils";

/** Marca o tutorial de boas-vindas como concluído para o usuário logado. */
export const POST = withApi(async () => {
  const { userId } = await requireAuth();

  await prisma.user.update({
    where: { id: userId },
    data: { onboardedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
});
