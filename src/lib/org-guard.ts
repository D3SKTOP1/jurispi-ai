import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";

/**
 * Guards de isolamento multi-tenant: garantem que referências cruzadas
 * (cliente, processo, documento) pertencem à organização do usuário.
 */

export async function assertClientInOrg(
  clientId: string | null | undefined,
  organizationId: string
): Promise<void> {
  if (!clientId) return;
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: { id: true },
  });
  if (!client) throw new ApiError(400, "Cliente não encontrado nesta organização.");
}

export async function assertCaseInOrg(
  caseId: string | null | undefined,
  organizationId: string
): Promise<void> {
  if (!caseId) return;
  const found = await prisma.industrialPropertyCase.findFirst({
    where: { id: caseId, organizationId },
    select: { id: true },
  });
  if (!found) throw new ApiError(400, "Processo não encontrado nesta organização.");
}
