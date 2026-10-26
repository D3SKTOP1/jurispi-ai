import { prisma } from "@/lib/db";

import { inpiMonitoringService } from "../monitoring/inpi-monitoring-service";
import { logSync } from "../inpi-source-registry";

/** Cruza os despachos de uma edição da RPI com os processos monitorados. */
export async function matchMonitoredProcessesJob(rpiNumber: string) {
  return inpiMonitoringService.matchMonitoredProcesses(rpiNumber);
}

/** Varre todas as edições processadas e garante alertas para novos matches. */
export async function createInpiAlerts(): Promise<{ alertsCreated: number }> {
  const issues = await prisma.rpiIssue.findMany({
    where: { status: "PROCESSED" },
    select: { number: true },
  });

  let alertsCreated = 0;
  for (const issue of issues) {
    const result = await inpiMonitoringService.matchMonitoredProcesses(issue.number);
    alertsCreated += result.alertsCreated;
  }

  await logSync({
    level: "INFO",
    message: `Varredura de alertas INPI: ${alertsCreated} alerta(s) criado(s) em ${issues.length} edição(ões).`,
  });

  return { alertsCreated };
}
