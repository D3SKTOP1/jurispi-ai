import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

interface AuditInput {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Registra uma ação importante no log de auditoria.
 * Falhas de auditoria não devem derrubar a operação principal.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("[audit] falha ao registrar auditoria:", error);
  }
}
