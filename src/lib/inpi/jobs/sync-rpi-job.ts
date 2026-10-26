import { prisma } from "@/lib/db";

import { inpiMonitoringService } from "../monitoring/inpi-monitoring-service";

/** Descobre novas edições da RPI e as registra para processamento. */
export async function discoverRpiIssues() {
  return inpiMonitoringService.discoverLatestRpiIssues();
}

/**
 * Sincroniza uma edição da RPI: parsing, despachos, matching e alertas.
 * Edições reais (registradas pela descoberta oficial) usam o pipeline em
 * fatias; edições fixture (dev/teste) seguem o caminho legado.
 */
export async function syncRpiIssueJob(rpiNumber: string) {
  const issue = await prisma.rpiIssue.findUnique({ where: { number: rpiNumber } });
  const metadata = (issue?.metadata ?? {}) as { fixture?: string; revistas?: unknown };

  if (metadata.fixture) {
    return inpiMonitoringService.syncRpiIssue(rpiNumber);
  }

  const { syncRealRpiIssueFully } = await import("../rpi-ingest");
  return syncRealRpiIssueFully(rpiNumber);
}
