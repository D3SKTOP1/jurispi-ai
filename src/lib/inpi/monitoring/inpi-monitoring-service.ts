import { promises as fs } from "fs";
import path from "path";

import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai/ai-provider";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";

import { checksumOf, saveInpiRawFile } from "../inpi-file-storage";
import { ensureDefaultSources, logSync } from "../inpi-source-registry";
import { normalizeRpiDispatch } from "../normalizers/rpi-normalizer";
import { normalizeProcessNumber, parseDateSafe } from "../normalizers/text-normalizer";
import { parseRpiXml } from "../parsers/xml-parser";
import {
  AUTO_DEADLINE_DISCLAIMER,
  deadlineRuleForDispatch,
  type DispatchEntity,
} from "./deadline-rules";

const FIXTURES_DIR = path.join(process.cwd(), "src", "lib", "inpi", "fixtures");

/**
 * InpiMonitoringService — RPI como fonte principal de acompanhamento.
 *
 * Fluxo: descobrir edições → registrar RpiIssue/RpiSection → baixar
 * XML/TXT (PDF como fallback/exibição) → salvar bruto → parsear →
 * RpiDispatch (dedupe) → cruzar com MonitoredProcess → criar Alert
 * por organização → resumo assistivo com IA.
 */
export class InpiMonitoringService {
  /**
   * Descobre edições novas da RPI no índice oficial (revistas.inpi.gov.br).
   * O modo de demonstração (fixture embutida, sem rede) só é usado quando
   * INPI_ENABLE_FIXTURES=true — nunca em produção.
   */
  async discoverLatestRpiIssues(): Promise<{
    discovered: string[];
    latestAvailable?: string | null;
  }> {
    await ensureDefaultSources();

    if (process.env.INPI_ENABLE_FIXTURES === "true") {
      return this.discoverFixtureIssue();
    }

    const { discoverRealRpiEditions } = await import("../rpi-editions");
    return discoverRealRpiEditions();
  }

  /** Registra a edição de demonstração embutida (apenas dev/teste). */
  private async discoverFixtureIssue(): Promise<{ discovered: string[] }> {
    const discovered: string[] = [];
    const fixture = "rpi-2799.xml";
    try {
      await fs.access(path.join(FIXTURES_DIR, fixture));
      const existing = await prisma.rpiIssue.findUnique({ where: { number: "2799" } });
      if (!existing) {
        await prisma.rpiIssue.create({
          data: {
            number: "2799",
            publishedAt: new Date("2026-07-07"),
            sourceUrl: `fixture://${fixture}`,
            status: "DISCOVERED",
            metadata: { fixture },
          },
        });
        discovered.push("2799");
      }
    } catch {
      // fixture ausente — ignora
    }

    await logSync({
      level: "INFO",
      message:
        discovered.length > 0
          ? `Descoberta de RPI (demonstração): edição(ões) ${discovered.join(", ")} registrada(s).`
          : "Descoberta de RPI (demonstração): nenhuma edição nova.",
    });

    return { discovered };
  }

  /** Sincroniza uma edição: baixa/lê seções, parseia e cruza com monitorados. */
  async syncRpiIssue(rpiNumber: string): Promise<{
    dispatchesCreated: number;
    alertsCreated: number;
    deadlinesCreated: number;
  }> {
    const issue = await prisma.rpiIssue.findUnique({ where: { number: rpiNumber } });
    if (!issue) throw new Error(`RPI ${rpiNumber} não registrada. Rode a descoberta antes.`);

    await prisma.rpiIssue.update({
      where: { id: issue.id },
      data: { status: "PROCESSING" },
    });

    let dispatchesCreated = 0;
    try {
      // Obtém o conteúdo XML da edição (fixture ou URL pública).
      let buffer: Buffer | null = null;
      let fileName = `rpi-${rpiNumber}.xml`;
      const fixture = (issue.metadata as { fixture?: string } | null)?.fixture;

      if (fixture) {
        buffer = await fs.readFile(path.join(FIXTURES_DIR, fixture));
        fileName = fixture;
      } else if (issue.sourceUrl && issue.sourceUrl.startsWith("http")) {
        const { downloadPublicFile } = await import("../inpi-file-storage");
        buffer = await downloadPublicFile(issue.sourceUrl);
      }

      if (!buffer) {
        throw new Error(
          `RPI ${rpiNumber} sem XML/TXT disponível. Use o PDF oficial como referência e aguarde fonte estruturada.`
        );
      }

      // Staging auditável do arquivo bruto.
      const checksum = checksumOf(buffer);
      let rawFile = await prisma.inpiRawFile.findUnique({ where: { checksum } });
      if (!rawFile) {
        const job = await prisma.inpiImportJob.create({
          data: {
            sourceType: "RPI",
            entityType: "RPI_DISPATCH",
            status: "RUNNING",
            fileName,
            startedAt: new Date(),
          },
        });
        const saved = await saveInpiRawFile({ buffer, fileName, sourceType: "RPI" });
        rawFile = await prisma.inpiRawFile.create({
          data: {
            importJobId: job.id,
            sourceType: "RPI",
            entityType: "RPI_DISPATCH",
            originalUrl: issue.sourceUrl,
            fileName,
            filePath: saved.filePath,
            mimeType: "application/xml",
            checksum: saved.checksum,
            sizeBytes: saved.sizeBytes,
            rpiNumber,
            rpiDate: issue.publishedAt,
          },
        });
        await prisma.inpiImportJob.update({
          where: { id: job.id },
          data: { status: "COMPLETED", finishedAt: new Date(), checksum },
        });
      }

      // Parse estruturado (XML) → seções e despachos.
      const parsedSections = parseRpiXml(buffer);
      for (const parsed of parsedSections) {
        let section = await prisma.rpiSection.findFirst({
          where: { rpiIssueId: issue.id, sectionCode: parsed.sectionCode },
        });
        if (!section) {
          section = await prisma.rpiSection.create({
            data: {
              rpiIssueId: issue.id,
              sectionCode: parsed.sectionCode,
              name: parsed.sectionName ?? parsed.sectionCode,
              xmlUrl: issue.sourceUrl,
              status: "PROCESSING",
            },
          });
        }

        for (const record of parsed.dispatches) {
          const { created } = await normalizeRpiDispatch({
            record,
            rpiSectionId: section.id,
            rpiNumber,
            rpiDate: parseDateSafe(parsed.publishedAt) ?? issue.publishedAt,
            sectionCode: parsed.sectionCode,
            sourceFileId: rawFile.id,
          });
          if (created) dispatchesCreated += 1;
        }

        await prisma.rpiSection.update({
          where: { id: section.id },
          data: { status: "PROCESSED" },
        });
      }

      await prisma.rpiIssue.update({
        where: { id: issue.id },
        data: { status: "PROCESSED" },
      });

      // Cruza com processos monitorados e gera alertas + prazos por organização.
      const { alertsCreated, deadlinesCreated } = await this.matchMonitoredProcesses(rpiNumber);

      await logSync({
        level: "INFO",
        message: `RPI ${rpiNumber} sincronizada: ${dispatchesCreated} despachos novos, ${alertsCreated} alertas, ${deadlinesCreated} prazos.`,
      });

      return { dispatchesCreated, alertsCreated, deadlinesCreated };
    } catch (error) {
      await prisma.rpiIssue.update({
        where: { id: issue.id },
        data: { status: "FAILED" },
      });
      await logSync({
        level: "ERROR",
        message: `Falha ao sincronizar RPI ${rpiNumber}: ${error instanceof Error ? error.message : "erro"}`,
      });
      throw error;
    }
  }

  /** Reprocessa uma seção específica já registrada. */
  async parseRpiSection(sectionId: string): Promise<void> {
    const section = await prisma.rpiSection.findUnique({
      where: { id: sectionId },
      include: { rpiIssue: true },
    });
    if (!section) throw new Error("Seção da RPI não encontrada.");
    await this.syncRpiIssue(section.rpiIssue.number);
  }

  /**
   * Cruza despachos de uma edição com MonitoredProcess (tenant-specific)
   * e cria os alertas correspondentes em cada organização.
   *
   * Parte dos processos monitorados (dezenas) e busca só os despachos
   * correspondentes — uma edição real tem ~40 mil despachos e carregá-los
   * todos por sync era inviável.
   */
  async matchMonitoredProcesses(
    rpiNumber: string
  ): Promise<{ alertsCreated: number; deadlinesCreated: number }> {
    const monitored = await prisma.monitoredProcess.findMany({
      where: { isActive: true },
    });
    if (monitored.length === 0) return { alertsCreated: 0, deadlinesCreated: 0 };

    const monitoredNumbers = [
      ...new Set(monitored.map((m) => normalizeProcessNumber(m.processNumber))),
    ];

    const dispatches = await prisma.rpiDispatch.findMany({
      where: {
        processNumber: { in: monitoredNumbers },
        rpiSection: { rpiIssue: { number: rpiNumber } },
      },
      include: { rpiSection: { include: { rpiIssue: true } } },
    });

    const matches = monitored.flatMap((mp) => {
      const mpNumber = normalizeProcessNumber(mp.processNumber);
      return dispatches
        .filter((d) => d.processNumber === mpNumber)
        .map((dispatch) => ({ monitored: mp, dispatch }));
    });

    const { alertsCreated, deadlinesCreated } =
      await this.createAlertsForMatchedDispatches(matches);

    await prisma.monitoredProcess.updateMany({
      where: { id: { in: monitored.map((m) => m.id) } },
      data: { lastCheckedAt: new Date() },
    });

    return { alertsCreated, deadlinesCreated };
  }

  /** Cria alertas e prazos (isolados por organização) para os despachos casados. */
  async createAlertsForMatchedDispatches(
    matches: Array<{
      monitored: {
        id: string;
        organizationId: string;
        caseId: string | null;
        processNumber: string;
        title: string | null;
        type: string;
      };
      dispatch: {
        id: string;
        processNumber: string;
        dispatchCode: string | null;
        dispatchText: string;
        rpiSection: {
          sectionCode: string;
          xmlUrl: string | null;
          pdfUrl: string | null;
          rpiIssue: { number: string; publishedAt: Date; sourceUrl: string | null };
        };
      };
    }>
  ): Promise<{ alertsCreated: number; deadlinesCreated: number }> {
    let alertsCreated = 0;
    let deadlinesCreated = 0;

    for (const { monitored, dispatch } of matches) {
      const rpi = dispatch.rpiSection.rpiIssue;
      const dedupeKey = `${dispatch.processNumber}|${rpi.number}|${dispatch.dispatchCode ?? ""}`;

      const existing = await prisma.alert.findFirst({
        where: {
          organizationId: monitored.organizationId,
          status: "OPEN",
          metadata: { path: ["dedupeKey"], equals: dedupeKey },
        },
        select: { id: true },
      });
      if (existing) continue;

      const severity = /(indeferimento|nulidade|caducidade|arquivamento)/i.test(
        dispatch.dispatchText
      )
        ? "CRITICAL"
        : /(oposi[cç][aã]o|exig[eê]ncia)/i.test(dispatch.dispatchText)
          ? "WARNING"
          : "INFO";

      await prisma.alert.create({
        data: {
          organizationId: monitored.organizationId,
          caseId: monitored.caseId,
          title: `RPI ${rpi.number}: nova publicação no processo ${dispatch.processNumber}`,
          description:
            `${monitored.title ? `${monitored.title} — ` : ""}` +
            `Despacho ${dispatch.dispatchCode ?? "s/ código"} (seção ${dispatch.rpiSection.sectionCode}), ` +
            `RPI ${rpi.number} de ${rpi.publishedAt.toLocaleDateString("pt-BR")}:\n\n` +
            `${dispatch.dispatchText}\n\nFonte: RPI (importação estruturada).`,
          severity,
          status: "OPEN",
          metadata: {
            dedupeKey,
            source: "RPI",
            rpiNumber: rpi.number,
            rpiDate: rpi.publishedAt.toISOString(),
            section: dispatch.rpiSection.sectionCode,
            processNumber: dispatch.processNumber,
            dispatchCode: dispatch.dispatchCode,
            dispatchId: dispatch.id,
            fileUrl: dispatch.rpiSection.xmlUrl ?? dispatch.rpiSection.pdfUrl ?? rpi.sourceUrl,
          },
        },
      });
      alertsCreated += 1;

      // Prazo automático, quando o despacho inicia prazo legal conhecido.
      const entity: DispatchEntity =
        monitored.type === "TRADEMARK" || monitored.type === "PATENT"
          ? monitored.type
          : "UNKNOWN";
      const created = await this.createDeadlineForDispatch({
        organizationId: monitored.organizationId,
        caseId: monitored.caseId,
        processNumber: dispatch.processNumber,
        monitoredTitle: monitored.title,
        dispatchText: dispatch.dispatchText,
        dispatchCode: dispatch.dispatchCode,
        entity,
        rpiNumber: rpi.number,
        publishedAt: rpi.publishedAt,
      });
      if (created) deadlinesCreated += 1;
    }

    return { alertsCreated, deadlinesCreated };
  }

  /**
   * Cria um Deadline a partir de um despacho, quando o código/texto inicia
   * prazo legal conhecido. Idempotente (dedupe por processo+RPI+tipo de prazo).
   * Retorna true se um prazo novo foi criado.
   */
  private async createDeadlineForDispatch(input: {
    organizationId: string;
    caseId: string | null;
    processNumber: string;
    monitoredTitle: string | null;
    dispatchText: string;
    dispatchCode: string | null;
    entity: DispatchEntity;
    rpiNumber: string;
    publishedAt: Date;
  }): Promise<boolean> {
    const rule = deadlineRuleForDispatch({
      dispatchText: input.dispatchText,
      dispatchCode: input.dispatchCode,
      entity: input.entity,
    });
    if (!rule) return false;

    const dedupeKey = `deadline|${input.processNumber}|${input.rpiNumber}|${rule.kind}`;
    const existing = await prisma.deadline.findFirst({
      where: {
        organizationId: input.organizationId,
        source: "RPI",
        metadata: { path: ["dedupeKey"], equals: dedupeKey },
      },
      select: { id: true },
    });
    if (existing) return false;

    const dueDate = new Date(input.publishedAt.getTime() + rule.days * 24 * 60 * 60 * 1000);

    await prisma.deadline.create({
      data: {
        organizationId: input.organizationId,
        caseId: input.caseId,
        title: `${rule.label} — processo ${input.processNumber}`,
        description:
          `${input.monitoredTitle ? `${input.monitoredTitle}. ` : ""}` +
          `Gerado do despacho ${input.dispatchCode ?? "s/ código"} publicado na RPI ${input.rpiNumber} ` +
          `(${input.publishedAt.toLocaleDateString("pt-BR")}). Base: ${rule.basis}.\n\n` +
          AUTO_DEADLINE_DISCLAIMER,
        dueDate,
        status: "PENDING",
        source: "RPI",
        processNumber: input.processNumber,
        metadata: {
          dedupeKey,
          kind: rule.kind,
          basis: rule.basis,
          days: rule.days,
          dispatchCode: input.dispatchCode,
          rpiNumber: input.rpiNumber,
          rpiDate: input.publishedAt.toISOString(),
        },
      },
    });
    return true;
  }

  /** Gera resumo assistivo (IA) de um despacho da RPI. */
  async generateDispatchSummary(dispatchId: string): Promise<string> {
    const dispatch = await prisma.rpiDispatch.findUnique({
      where: { id: dispatchId },
      include: { rpiSection: { include: { rpiIssue: true } } },
    });
    if (!dispatch) throw new Error("Despacho não encontrado.");

    const provider = getAIProvider();
    const { text } = await provider.generateText({
      system: SYSTEM_PROMPT,
      prompt: `Resuma de forma assistiva o despacho abaixo, publicado na RPI ${dispatch.rpiSection.rpiIssue.number} (${dispatch.rpiSection.rpiIssue.publishedAt.toLocaleDateString("pt-BR")}), seção ${dispatch.rpiSection.sectionCode}, processo ${dispatch.processNumber}. Explique o significado prático e os próximos passos possíveis, sem inventar prazos específicos.

DESPACHO:
${dispatch.dispatchText}

Estruture: (1) o que aconteceu; (2) significado prático; (3) próximos passos possíveis; (4) aviso de que a leitura oficial da RPI é indispensável.`,
      maxTokens: 800,
    });

    return text;
  }
}

export const inpiMonitoringService = new InpiMonitoringService();
