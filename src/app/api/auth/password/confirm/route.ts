import { NextResponse } from "next/server";

import { ApiError, parseBody, withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { confirmPasswordReset } from "@/lib/auth/password-reset";
import { passwordResetConfirmSchema } from "@/lib/validators";

/** Confirma a redefinição com o token do e-mail e define a nova senha. */
export const POST = withApi(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  await enforceRateLimit(`pwd-reset-confirm:${ip}`, 10, 60 * 60 * 1000);

  const { token, password } = await parseBody(req, passwordResetConfirmSchema);
  const result = await confirmPasswordReset(token, password);
  if (!result.ok) throw new ApiError(400, result.error ?? "Não foi possível redefinir a senha.");

  return NextResponse.json({ ok: true, message: "Senha redefinida. Você já pode entrar." });
});
