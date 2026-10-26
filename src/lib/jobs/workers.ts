/**
 * Workers BullMQ — processo separado do Next.js.
 *
 * Execução: npm run worker  (requer REDIS_URL no .env)
 *
 * Filas:
 * - document-processing: extração de texto, chunking e embeddings;
 * - alerts: varredura periódica de prazos (repeatable job de hora em hora).
 */
import "dotenv/config";

import { Queue, Worker } from "bullmq";

import { runDeadlineScan } from "./alert-job";
import { processDocument } from "./document-processing-job";
import { ALERT_QUEUE, DOCUMENT_QUEUE, redisConnectionOptions } from "./queues";

async function main() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error(
      "[worker] REDIS_URL não configurado. Sem Redis, os jobs rodam inline no servidor Next.js — o worker não é necessário."
    );
    process.exit(1);
  }

  const connection = redisConnectionOptions(redisUrl);

  const documentWorker = new Worker(
    DOCUMENT_QUEUE,
    async (job) => {
      console.log(`[worker] processando documento ${job.data.documentId}…`);
      await processDocument(job.data.documentId);
    },
    { connection, concurrency: 2 }
  );

  const alertWorker = new Worker(
    ALERT_QUEUE,
    async () => {
      const result = await runDeadlineScan();
      console.log(
        `[worker] varredura de prazos: ${result.overdue} vencidos, ${result.upcoming} próximos.`
      );
    },
    { connection }
  );

  // Agenda a varredura de prazos de hora em hora.
  const alertQueue = new Queue(ALERT_QUEUE, { connection });
  await alertQueue.upsertJobScheduler("deadline-scan-hourly", { every: 60 * 60 * 1000 });

  documentWorker.on("failed", (job, err) =>
    console.error(`[worker] job ${job?.id} falhou:`, err.message)
  );
  alertWorker.on("failed", (job, err) =>
    console.error(`[worker] job de alerta ${job?.id} falhou:`, err.message)
  );

  console.log("[worker] JurisPI AI workers ativos. Aguardando jobs…");
}

main().catch((error) => {
  console.error("[worker] erro fatal:", error);
  process.exit(1);
});
