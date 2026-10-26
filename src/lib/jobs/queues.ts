import type { Queue } from "bullmq";

export const DOCUMENT_QUEUE = "document-processing";
export const ALERT_QUEUE = "alerts";

let documentQueue: Queue | null = null;
let alertQueue: Queue | null = null;
let initialized = false;

function redisAvailable(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/** Converte REDIS_URL em opções de conexão aceitas pelo BullMQ. */
export function redisConnectionOptions(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== "/" ? Number(parsed.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null,
  };
}

async function initQueues(): Promise<void> {
  if (initialized || !redisAvailable()) return;
  const { Queue } = await import("bullmq");

  const connection = redisConnectionOptions(process.env.REDIS_URL!);
  documentQueue = new Queue(DOCUMENT_QUEUE, { connection });
  alertQueue = new Queue(ALERT_QUEUE, { connection });
  initialized = true;
}

/**
 * Executa trabalho em background sem bloquear a resposta.
 * Em ambiente serverless (Vercel), usa `after()` do Next para manter a
 * função viva até o término; fora do Next (workers tsx), fire-and-forget.
 */
export async function runInBackground(
  work: () => Promise<unknown>,
  label: string
): Promise<void> {
  const run = () =>
    work().catch((error) => console.error(`[jobs] ${label} falhou:`, error));
  try {
    const { after } = await import("next/server");
    after(run);
  } catch {
    void run();
  }
}

/**
 * Enfileira o processamento de um documento.
 * Com REDIS_URL configurado, usa BullMQ; sem Redis, processa inline
 * em background (serverless-safe via after()).
 */
export async function enqueueDocumentProcessing(documentId: string): Promise<void> {
  if (redisAvailable()) {
    await initQueues();
    await documentQueue!.add(
      "process-document",
      { documentId },
      { attempts: 2, backoff: { type: "exponential", delay: 5_000 } }
    );
    return;
  }

  const { processDocument } = await import("./document-processing-job");
  await runInBackground(() => processDocument(documentId), "processamento de documento");
}

/** Enfileira (ou executa inline) a varredura de prazos/alertas. */
export async function enqueueDeadlineScan(): Promise<void> {
  if (redisAvailable()) {
    await initQueues();
    await alertQueue!.add("deadline-scan", {});
    return;
  }

  const { runDeadlineScan } = await import("./alert-job");
  await runInBackground(() => runDeadlineScan(), "varredura de prazos");
}
