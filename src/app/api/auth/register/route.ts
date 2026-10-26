import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { prisma } from "@/lib/db";
import { ApiError, parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validators";

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Cria uma conta de teste: usuário + organização própria (multi-tenant).
 * A base pública do INPI é global, então a conta nova já nasce com busca
 * de marcas/patentes e chat com ferramentas INPI funcionando.
 */
export const POST = withApi(async (req) => {
  // Cadastro público é DESLIGADO por padrão (evita contas de estranhos em
  // produção). Ligue com PUBLIC_SIGNUP=true; contas internas via scripts/create-user.
  if (process.env.PUBLIC_SIGNUP !== "true") {
    throw new ApiError(403, "Cadastro fechado. Solicite acesso ao administrador.");
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  await enforceRateLimit(`register:${ip}`, 5, 60 * 60 * 1000);

  const data = await parseBody(req, registerSchema);
  const email = data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new ApiError(409, "Já existe uma conta com este e-mail. Faça login.");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const slug = `${slugify(data.organizationName) || "org"}-${crypto.randomBytes(3).toString("hex")}`;

  const organization = await prisma.organization.create({
    data: {
      name: data.organizationName.trim(),
      slug,
      members: {
        create: {
          role: "ADMIN",
          user: {
            create: { name: data.name.trim(), email, passwordHash },
          },
        },
      },
    },
  });

  await logAudit({
    organizationId: organization.id,
    action: "auth.register",
    entityType: "Organization",
    entityId: organization.id,
    metadata: { email, trial: true },
  });

  return NextResponse.json(
    { ok: true, message: "Conta criada. Você já pode entrar." },
    { status: 201 }
  );
});
