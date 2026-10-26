import type { InpiJobName } from "./queues";

/**
 * Roteador de jobs INPI — usado tanto pelo worker BullMQ quanto pelo
 * fallback inline. Todos os jobs são idempotentes (checksum/dedupe).
 */
export async function runInpiJob(
  jobName: InpiJobName,
  data: Record<string, unknown>
): Promise<unknown> {
  switch (jobName) {
    case "syncOpenDataSources": {
      const { syncOpenDataSources } = await import("./sync-open-data-job");
      return syncOpenDataSources();
    }
    case "downloadInpiFile": {
      const { downloadInpiFile } = await import("./sync-open-data-job");
      return downloadInpiFile(String(data.url), String(data.entityType ?? "TRADEMARK") as never);
    }
    case "parseInpiRawFile": {
      const { parseInpiRawFile } = await import("./parse-file-job");
      return parseInpiRawFile(String(data.rawFileId));
    }
    case "normalizeTrademarkRecords": {
      const { normalizeTrademarkRecords } = await import("./normalize-records-job");
      return normalizeTrademarkRecords();
    }
    case "normalizePatentRecords": {
      const { normalizePatentRecords } = await import("./normalize-records-job");
      return normalizePatentRecords();
    }
    case "normalizeRpiDispatches": {
      const { normalizeRpiDispatches } = await import("./normalize-records-job");
      return normalizeRpiDispatches();
    }
    case "indexTrademarkRecords": {
      const { indexTrademarkRecords } = await import("./index-records-job");
      return indexTrademarkRecords();
    }
    case "indexPatentRecords": {
      const { indexPatentRecords } = await import("./index-records-job");
      return indexPatentRecords();
    }
    case "generateInpiEmbeddings": {
      const { generateInpiEmbeddings } = await import("./index-records-job");
      return generateInpiEmbeddings();
    }
    case "discoverRpiIssues": {
      const { discoverRpiIssues } = await import("./sync-rpi-job");
      return discoverRpiIssues();
    }
    case "syncRpiIssue": {
      const { syncRpiIssueJob } = await import("./sync-rpi-job");
      return syncRpiIssueJob(String(data.rpiNumber));
    }
    case "matchMonitoredProcesses": {
      const { matchMonitoredProcessesJob } = await import("./match-monitored-processes-job");
      return matchMonitoredProcessesJob(String(data.rpiNumber));
    }
    case "createInpiAlerts": {
      const { createInpiAlerts } = await import("./match-monitored-processes-job");
      return createInpiAlerts();
    }
    default:
      throw new Error(`Job INPI desconhecido: ${jobName}`);
  }
}
