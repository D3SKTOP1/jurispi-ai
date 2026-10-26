import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { parseBody, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { einpiCredentialService } from "@/lib/inpi/gru/einpi-credential-service";
import { einpiCredentialSchema } from "@/lib/validators";

/** Status da credencial e-INPI (nunca devolve login/senha em claro). */
export const GET = withApi(async () => {
  const { organizationId } = await requireAuth();
  return NextResponse.json(await einpiCredentialService.status(organizationId));
});

/**
 * Conecta a conta INPI: salva a credencial (cifrada) e autentica ao vivo
 * no INPI, devolvendo o status (OK/INVALID/UNAVAILABLE). Login recusado
 * não deixa credencial guardada.
 */
export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();
  // Cada conexão faz um login real no INPI — limita para não bloquear a conta.
  await enforceRateLimit(`einpi-cred:${userId}`, 6, 60_000);

  const data = await parseBody(req, einpiCredentialSchema);
  const status = await einpiCredentialService.connect(organizationId, data.login, data.senha);

  await logAudit({
    organizationId,
    userId,
    action: "inpi.einpi.credential.connect",
    entityType: "InpiEinpiCredential",
    // Nunca registrar a senha; só o resultado da autenticação.
    metadata: { result: status.lastStatus },
  });

  return NextResponse.json(status);
});

/** Remove a credencial. */
export const DELETE = withApi(async () => {
  const { organizationId, userId } = await requireAuth();
  await einpiCredentialService.remove(organizationId);
  await logAudit({
    organizationId,
    userId,
    action: "inpi.einpi.credential.remove",
    entityType: "InpiEinpiCredential",
  });
  return NextResponse.json({ ok: true });
});
