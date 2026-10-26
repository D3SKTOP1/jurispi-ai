"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, DatabaseZap, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Atualização da base INPI a partir da RPI oficial.
 *
 * O servidor processa uma FATIA por chamada (limite serverless); o botão
 * encadeia as chamadas e mostra o progresso em linguagem simples:
 * descoberta → para cada edição pendente → Marcas → Patentes → Programas.
 */

interface SliceProgress {
  done: boolean;
  rpiNumber: string;
  revistaLabel?: string;
  cursor?: number;
  totalChunks?: number;
  message: string;
}

interface PendingIssue {
  number: string;
  status: string;
}

const MAX_SLICES = 400; // ~30 edições — trava de segurança do loop.

function formatCount(n: number): string {
  return n.toLocaleString("pt-BR");
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? `Falha na requisição (${res.status}).`);
  }
  return data as T;
}

export function UpdateInpiBaseButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [label, setLabel] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const cancelled = useRef(false);

  /** Uma fatia com nova tentativa: quedas transitórias de conexão não
   * devem abortar uma importação de vários minutos. */
  async function syncSliceWithRetry(rpiNumber: string): Promise<SliceProgress> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await postJson<SliceProgress>("/api/inpi/rpi/sync", { rpiNumber });
      } catch (error) {
        if (attempt >= 3) throw error;
        setLabel(`Conexão instável — tentando de novo (${attempt}/3)…`);
        await new Promise((r) => setTimeout(r, attempt * 5_000));
      }
    }
  }

  async function syncIssue(rpiNumber: string): Promise<void> {
    for (let i = 0; i < MAX_SLICES; i++) {
      if (cancelled.current) return;
      const progress = await syncSliceWithRetry(rpiNumber);
      if (progress.done) return;
      if (progress.revistaLabel && progress.totalChunks) {
        const cursor = progress.cursor ?? 0;
        setLabel(
          `RPI ${rpiNumber} — ${progress.revistaLabel}: ${formatCount(cursor)} de ${formatCount(progress.totalChunks)} publicações`
        );
        setPct(Math.round((cursor / progress.totalChunks) * 100));
      } else {
        setLabel(`RPI ${rpiNumber} — ${progress.message}`);
        setPct(null);
      }
    }
    throw new Error("A sincronização excedeu o limite de tentativas.");
  }

  async function run() {
    cancelled.current = false;
    setPhase("running");
    setPct(null);
    setLabel("Consultando as edições publicadas pelo INPI…");
    try {
      const discovery = await postJson<{ pending: PendingIssue[]; message: string }>(
        "/api/inpi/rpi/discover"
      );

      if (discovery.pending.length === 0) {
        setPhase("done");
        setLabel("Base já atualizada — nenhuma edição nova no INPI.");
        setPct(null);
        router.refresh();
        return;
      }

      for (const issue of discovery.pending) {
        setLabel(`Importando a RPI ${issue.number}…`);
        setPct(null);
        await syncIssue(issue.number);
        router.refresh();
      }

      setPhase("done");
      setLabel(
        `Base atualizada — ${discovery.pending.length} edição(ões) da RPI importada(s).`
      );
      setPct(null);
      router.refresh();
    } catch (error) {
      setPhase("error");
      setLabel(error instanceof Error ? error.message : "Erro na atualização.");
      setPct(null);
    }
  }

  const running = phase === "running";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button onClick={run} disabled={running}>
        <DatabaseZap className={`h-4 w-4 ${running ? "animate-pulse" : ""}`} />
        {running ? "Atualizando…" : "Atualizar base do INPI"}
      </Button>
      {label && (
        <div className="flex max-w-xs flex-col items-end gap-1 text-right sm:max-w-md">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {phase === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
            {phase === "error" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
            {label}
          </span>
          {pct !== null && (
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Sincroniza uma única edição (usado na listagem de edições da RPI). */
export function SyncRpiButton({ rpiNumber }: { rpiNumber: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setMessage(null);
    try {
      for (let i = 0; i < MAX_SLICES; i++) {
        const progress = await postJson<SliceProgress>("/api/inpi/rpi/sync", { rpiNumber });
        if (progress.done) {
          setMessage("Edição sincronizada.");
          break;
        }
        if (progress.revistaLabel && progress.totalChunks) {
          const cursor = progress.cursor ?? 0;
          setMessage(
            `${progress.revistaLabel}: ${Math.round((cursor / progress.totalChunks) * 100)}%`
          );
        }
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro na sincronização.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
      <Button variant="outline" size="sm" onClick={sync} disabled={loading}>
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        Sincronizar
      </Button>
    </div>
  );
}
