/**
 * Workers BullMQ da integração INPI — processo separado do Next.js.
 *
 * Execução: npm run worker:inpi  (requer REDIS_URL no .env)
 *
 * Agendas automáticas:
 * - descoberta de novas edições da RPI: semanal;
 * - sync de dados abertos: semanal;
 * - varredura de alertas: diária.
 */
import "dotenv/config";

import { Queue, Worker } from "bullmq";

import { redisConnectionOptions } from "@/lib/jobs/queues";

import { runInpiJob } from "./job-runner";
import { INPI_QUEUES, type InpiJobName } from "./queues";

async function main() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error(
      "[inpi-worker] REDIS_URL não configurado. Sem Redis, os jobs INPI rodam inline no servidor Next.js."
    );
    process.exit(1);
  }

  const connection = redisConnectionOptions(redisUrl);
  const queueNames = Object.values(INPI_QUEUES);

  for (const queueName of queueNames) {
    const worker = new Worker(
      queueName,
      async (job) => {
        console.log(`[inpi-worker] ${queueName} → ${job.name}`);
        return runInpiJob(job.name as InpiJobName, job.data ?? {});
      },
      { connection, concurrency: 2 }
    );
    worker.on("failed", (job, err) =>
      console.error(`[inpi-worker] ${queueName}/${job?.name} falhou:`, err.message)
    );
  }

  // Agendas recorrentes.
  const rpiQueue = new Queue(INPI_QUEUES.RPI_SYNC, { connection });
  await rpiQueue.upsertJobScheduler(
    "discover-rpi-weekly",
    { every: 7 * 24 * 60 * 60 * 1000 },
    { name: "discoverRpiIssues" }
  );

  const openDataQueue = new Queue(INPI_QUEUES.OPEN_DATA_SYNC, { connection });
  await openDataQueue.upsertJobScheduler(
    "open-data-weekly",
    { every: 7 * 24 * 60 * 60 * 1000 },
    { name: "syncOpenDataSources" }
  );

  const monitoringQueue = new Queue(INPI_QUEUES.MONITORING, { connection });
  await monitoringQueue.upsertJobScheduler(
    "inpi-alerts-daily",
    { every: 24 * 60 * 60 * 1000 },
    { name: "createInpiAlerts" }
  );

  console.log(`[inpi-worker] ${queueNames.length} filas ativas. Aguardando jobs…`);
}

main().catch((error) => {
  console.error("[inpi-worker] erro fatal:", error);
  process.exit(1);
});
