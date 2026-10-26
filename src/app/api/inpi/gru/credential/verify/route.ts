import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { einpiCredentialService } from "@/lib/inpi/gru/einpi-credential-service";

/** Testa o login e-INPI e devolve o status (OK/INVALID/UNAVAILABLE). */
export const POST = withApi(async () => {
  const { organizationId, userId } = await requireAuth();
  // Login no INPI é caro/limitado — protege contra abuso e bloqueio da conta.
  await enforceRateLimit(`einpi-verify:${userId}`, 5, 60_000);

  const status = await einpiCredentialService.verify(organizationId);

  await logAudit({
    organizationId,
    userId,
    action: "inpi.einpi.credential.verify",
    entityType: "InpiEinpiCredential",
    metadata: { result: status.lastStatus },
  });

  return NextResponse.json(status);
});
