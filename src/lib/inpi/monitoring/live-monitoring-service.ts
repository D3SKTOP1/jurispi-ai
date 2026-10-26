import "server-only";

import { prisma } from "@/lib/db";

import { PePiLiveProvider } from "../providers/pepi-live-provider";
import { normalizeProcessNumber } from "../normalizers/text-normalizer";
import type { InpiDispatchResult } from "../types";
import {
  AUTO_DEADLINE_DISCLAIMER,
  deadlineRuleForDispatch,
  type DispatchEntity,
} from "./deadline-rules";

const provider = new PePiLiveProvider();

interface MonitoredInput {
  id: string;
  organizationId: string;
  caseId: string | null;
  processNumber: string;
  title: string | null;
  type: string;
}

/**
 * LiveMonitoringService — acompanhamento AO VIVO, por processo.
 *
 * Em vez de ingerir a RPI inteira e filtrar, consulta o pePI diretamente
 * para cada processo monitorado, compara os despachos com o que já foi
 * registrado (dedupe por processo+RPI+código) e gera alertas + prazos nos
 * despachos novos. Muito mais leve para o volume real (dezenas de processos)
 * e coerente com a diretriz live-first. O dedupe usa o MESMO formato de
 * chave do caminho antigo, então não duplica se ambos rodarem.
 */
export class LiveMonitoringService {
  /** Verifica um processo ao vivo e gera alertas/prazos nos despachos novos. */
  async checkProcess(
    monitored: MonitoredInput
  ): Promise<{ alertsCreated: number; deadlinesCreated: number }> {
    const dispatches = await provider.getDispatches(monitored.processNumber);
    const entity: DispatchEntity =
      monitored.type === "TRADEMARK" || monitored.type === "PATENT"
        ? monitored.type
        : "UNKNOWN";

    let alertsCreated = 0;
    let deadlinesCreated = 0;
    for (const dispatch of dispatches) {
      const r = await this.recordDispatch(monitored, dispatch, entity);
      if (r.alert) alertsCreated += 1;
      if (r.deadline) deadlinesCreated += 1;
    }

    await prisma.monitoredProcess.update({
      where: { id: monitored.id },
      data: { lastCheckedAt: new Date() },
    });
    return { alertsCreated, deadlinesCreated };
  }

  private async recordDispatch(
    monitored: MonitoredInput,
    dispatch: InpiDispatchResult,
    entity: DispatchEntity
  ): Promise<{ alert: boolean; deadline: boolean }> {
    const processNumber = normalizeProcessNumber(monitored.processNumber);
    const rpiNumber = dispatch.rpiNumber ?? "";
    const dedupeKey = `${processNumber}|${rpiNumber}|${dispatch.dispatchCode ?? ""}`;

    let alert = false;
    const existingAlert = await prisma.alert.findFirst({
      where: {
        organizationId: monitored.organizationId,
        metadata: { path: ["dedupeKey"], equals: dedupeKey },
      },
      select: { id: true },
    });
    if (!existingAlert) {
      const severity = /(indeferimento|nulidade|caducidade|arquivamento)/i.test(dispatch.dispatchText)
        ? "CRITICAL"
        : /(oposi[cç][aã]o|exig[eê]ncia)/i.test(dispatch.dispatchText)
          ? "WARNING"
          : "INFO";
      const rpiLabel = rpiNumber ? `RPI ${rpiNumber}` : "INPI";
      await prisma.alert.create({
        data: {
          organizationId: monitored.organizationId,
          caseId: monitored.caseId,
          title: `${rpiLabel}: nova publicação no processo ${monitored.processNumber}`,
          description:
            `${monitored.title ? `${monitored.title} — ` : ""}` +
            `Despacho ${dispatch.dispatchCode ?? "s/ código"}${
              dispatch.rpiDate ? ` (${dispatch.rpiDate.toLocaleDateString("pt-BR")})` : ""
            }:\n\n${dispatch.dispatchText}\n\nFonte: pePI (consulta ao vivo).`,
          severity,
          status: "OPEN",
          metadata: {
            dedupeKey,
            source: "PEPI_LIVE",
            rpiNumber,
            rpiDate: dispatch.rpiDate ? dispatch.rpiDate.toISOString() : null,
            processNumber,
            dispatchCode: dispatch.dispatchCode,
          },
        },
      });
      alert = true;
    }

    let deadline = false;
    const rule = deadlineRuleForDispatch({
      dispatchText: dispatch.dispatchText,
      dispatchCode: dispatch.dispatchCode,
      entity,
    });
    if (rule && dispatch.rpiDate) {
      const dKey = `deadline|${processNumber}|${rpiNumber}|${rule.kind}`;
      const existingDeadline = await prisma.deadline.findFirst({
        where: {
          organizationId: monitored.organizationId,
          source: "RPI",
          metadata: { path: ["dedupeKey"], equals: dKey },
        },
        select: { id: true },
      });
      if (!existingDeadline) {
        const dueDate = new Date(dispatch.rpiDate.getTime() + rule.days * 24 * 60 * 60 * 1000);
        await prisma.deadline.create({
          data: {
            organizationId: monitored.organizationId,
            caseId: monitored.caseId,
            title: `${rule.label} — processo ${monitored.processNumber}`,
            description:
              `${monitored.title ? `${monitored.title}. ` : ""}` +
              `Gerado do despacho ${dispatch.dispatchCode ?? "s/ código"}` +
              `${rpiNumber ? ` (RPI ${rpiNumber})` : ""} publicado em ` +
              `${dispatch.rpiDate.toLocaleDateString("pt-BR")}. Base: ${rule.basis}.\n\n` +
              AUTO_DEADLINE_DISCLAIMER,
            dueDate,
            status: "PENDING",
            source: "RPI",
            processNumber,
            metadata: {
              dedupeKey: dKey,
              kind: rule.kind,
              basis: rule.basis,
              days: rule.days,
              dispatchCode: dispatch.dispatchCode,
              rpiNumber,
              rpiDate: dispatch.rpiDate.toISOString(),
            },
          },
        });
        deadline = true;
      }
    }

    return { alert, deadline };
  }

  /**
   * Varredura (cron): checa processos ativos ao vivo, dos menos recentemente
   * verificados para os mais. Sequencial e tolerante a falha (um processo que
   * falha não derruba a varredura). `limit` protege o teto de duração serverless.
   */
  async runScan(opts?: {
    organizationId?: string;
    limit?: number;
  }): Promise<{ processed: number; alertsCreated: number; deadlinesCreated: number; errors: number }> {
    const monitored = await prisma.monitoredProcess.findMany({
      where: {
        isActive: true,
        ...(opts?.organizationId ? { organizationId: opts.organizationId } : {}),
      },
      orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
      take: opts?.limit ?? 40,
      select: {
        id: true,
        organizationId: true,
        caseId: true,
        processNumber: true,
        title: true,
        type: true,
      },
    });

    let processed = 0;
    let alertsCreated = 0;
    let deadlinesCreated = 0;
    let errors = 0;
    for (const mp of monitored) {
      try {
        const r = await this.checkProcess(mp);
        alertsCreated += r.alertsCreated;
        deadlinesCreated += r.deadlinesCreated;
        processed += 1;
      } catch (error) {
        errors += 1;
        console.error(`[monitor] falha ao checar ${mp.processNumber}:`, error);
      }
    }
    return { processed, alertsCreated, deadlinesCreated, errors };
  }
}

export const liveMonitoringService = new LiveMonitoringService();
