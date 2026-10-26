import { NextResponse } from "next/server";

import { parseBody, withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { passwordResetRequestSchema } from "@/lib/validators";

/** Solicita redefinição de senha (envia link por e-mail). Resposta sempre neutra. */
export const POST = withApi(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  await enforceRateLimit(`pwd-reset-req:${ip}`, 5, 60 * 60 * 1000);

  const { email } = await parseBody(req, passwordResetRequestSchema);
  await requestPasswordReset(email);

  // Nunca revela se o e-mail existe.
  return NextResponse.json({
    ok: true,
    message: "Se houver uma conta com esse e-mail, enviamos um link de redefinição.",
  });
});
