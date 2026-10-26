import "server-only";

import crypto from "crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { sendEmail, emailLayout, esc } from "@/lib/email/mailer";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function appUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://jurispi-ai.vercel.app"
  ).replace(/\/$/, "");
}

/**
 * Solicita redefinição: cria token de uso único (1h) e envia o link por
 * e-mail. NUNCA revela se o e-mail existe (resposta sempre "ok").
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true },
  });
  if (!user) return; // silencioso: não vaza existência de conta

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const link = `${appUrl()}/redefinir-senha?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "Redefinição de senha — JurisPI",
    html: emailLayout(
      "Redefinir sua senha",
      `<p style="font-size:14px;line-height:1.6;">Olá, ${esc(user.name)}. Recebemos um pedido para redefinir sua senha no JurisPI.</p>
       <p style="font-size:14px;line-height:1.6;">Clique no botão abaixo para escolher uma nova senha. O link expira em 1 hora e só pode ser usado uma vez.</p>
       <p style="margin:20px 0;"><a href="${link}" style="background:#0d5c6b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block;">Redefinir senha</a></p>
       <p style="font-size:12px;color:#6d7f85;line-height:1.6;">Se você não pediu isto, ignore este e-mail — sua senha continua a mesma.</p>`
    ),
    text: `Redefina sua senha no JurisPI: ${link} (expira em 1 hora, uso único). Se não foi você, ignore.`,
  });
}

/** Confirma a redefinição: valida o token (não usado, não expirado) e troca a senha. */
export async function confirmPasswordReset(
  token: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "Link inválido ou expirado. Solicite um novo." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Invalida quaisquer outros tokens pendentes desse usuário.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  return { ok: true };
}
