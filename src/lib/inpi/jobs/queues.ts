import type { Queue } from "bullmq";

/**
 * Filas BullMQ da integração INPI.
 * Sem REDIS_URL, os jobs executam inline em background no mesmo processo
 * (fallback de desenvolvimento) — a interface do usuário nunca bloqueia.
 */
export const INPI_QUEUES = {
  OPEN_DATA_SYNC: "inpi-open-data-sync",
  RPI_SYNC: "inpi-rpi-sync",
  FILE_PARSER: "inpi-file-parser",
  NORMALIZATION: "inpi-normalization",
  INDEXING: "inpi-indexing",
  MONITORING: "inpi-monitoring",
  EMBEDDING: "inpi-embedding",
} as const;

export type InpiQueueName = (typeof INPI_QUEUES)[keyof typeof INPI_QUEUES];

export type InpiJobName =
  | "syncOpenDataSources"
  | "downloadInpiFile"
  | "parseInpiRawFile"
  | "normalizeTrademarkRecords"
  | "normalizePatentRecords"
  | "normalizeRpiDispatches"
  | "indexTrademarkRecords"
  | "indexPatentRecords"
  | "generateInpiEmbeddings"
  | "discoverRpiIssues"
  | "syncRpiIssue"
  | "matchMonitoredProcesses"
  | "createInpiAlerts";

const queues = new Map<InpiQueueName, Queue>();
let connectionOptions: Record<string, unknown> | null = null;

function redisAvailable(): boolean {
  return Boolean(process.env.REDIS_URL);
}

async function getQueue(name: InpiQueueName): Promise<Queue> {
  if (!queues.has(name)) {
    const { Queue } = await import("bullmq");
    if (!connectionOptions) {
      const { redisConnectionOptions } = await import("@/lib/jobs/queues");
      connectionOptions = redisConnectionOptions(process.env.REDIS_URL!);
    }
    queues.set(name, new Queue(name, { connection: connectionOptions as never }));
  }
  return queues.get(name)!;
}

/** Executa um job inline (fallback sem Redis). */
export async function runInpiJobInline(jobName: InpiJobName, data: Record<string, unknown>) {
  const jobs = await import("./job-runner");
  return jobs.runInpiJob(jobName, data);
}

/**
 * Enfileira um job INPI (BullMQ com retry/backoff) ou executa inline
 * em background quando não há Redis (serverless-safe via after()).
 */
export async function enqueueInpiJob(
  queueName: InpiQueueName,
  jobName: InpiJobName,
  data: Record<string, unknown> = {}
): Promise<void> {
  if (redisAvailable()) {
    const queue = await getQueue(queueName);
    await queue.add(jobName, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
    return;
  }

  const { runInBackground } = await import("@/lib/jobs/queues");
  await runInBackground(() => runInpiJobInline(jobName, data), `job INPI ${jobName}`);
}
