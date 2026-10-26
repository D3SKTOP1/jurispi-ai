import "server-only";

import { prisma } from "@/lib/db";

import { einpiCredentialService } from "./einpi-credential-service";
import {
  GruRejectedError,
  downloadBoletoPdf,
  fetchGruStatus,
  fetchServiceConfig,
  fetchServiceOptions,
  fetchServiceTypes,
  fetchServices,
  previewGru,
  searchGrus,
  submitGruEmission,
  withGruSession,
  type GruEmissionParams,
  type GruPreviewResult,
  type GruServiceConfig,
  type GruServiceItem,
  type GruServiceOptions,
  type GruServiceType,
  type GruStatusResult,
} from "./gru-client";

/** Erro quando a organização ainda não conectou a conta INPI. */
export class GruNoCredentialError extends Error {
  constructor() {
    super("Conecte a conta e-INPI (em INPI → GRU / e-INPI) antes de emitir ou consultar GRU.");
    this.name = "GruNoCredentialError";
  }
}

/** dd/MM/yyyy para os formulários do portal. */
function toPortalDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/**
 * GruService — orquestra emissão e consulta de GRU usando a credencial
 * e-INPI do cofre. Cada operação abre uma sessão nova no portal (login),
 * executa e registra o resultado em InpiGru.
 */
export class GruService {
  private async credentials(organizationId: string) {
    const cred = await einpiCredentialService.getDecrypted(organizationId);
    if (!cred) throw new GruNoCredentialError();
    return cred;
  }

  /** Diretorias ("Tipo de Serviço") do assistente de emissão. */
  async getServiceTypes(organizationId: string): Promise<GruServiceType[]> {
    const cred = await this.credentials(organizationId);
    return withGruSession(cred, (s) => fetchServiceTypes(s));
  }

  /** Serviços da tabela de retribuições de uma diretoria. */
  async getServices(organizationId: string, diretoria: string): Promise<GruServiceItem[]> {
    const cred = await this.credentials(organizationId);
    return withGruSession(cred, (s) => fetchServices(s, diretoria));
  }

  /** Campos exigidos + opções dos selects do serviço escolhido (1 sessão). */
  async getServiceDetail(
    organizationId: string,
    diretoria: string,
    serviceCode: string
  ): Promise<{ config: GruServiceConfig; options: GruServiceOptions }> {
    const cred = await this.credentials(organizationId);
    return withGruSession(cred, async (s) => {
      const config = await fetchServiceConfig(s, serviceCode, diretoria);
      const options = await fetchServiceOptions(s, config, serviceCode, diretoria);
      return { config, options };
    });
  }

  /** Preview do valor no INPI — não gera a GRU. */
  async preview(organizationId: string, params: GruEmissionParams): Promise<GruPreviewResult> {
    const cred = await this.credentials(organizationId);
    return withGruSession(cred, (s) => previewGru(s, params));
  }

  /** Emite uma GRU (guia REAL no INPI) e registra em InpiGru. */
  async issueGru(organizationId: string, params: GruEmissionParams & { description?: string }) {
    const cred = await this.credentials(organizationId);

    const credentialRow = await prisma.inpiEinpiCredential.findUnique({
      where: { organizationId },
      select: { id: true },
    });

    const result = await withGruSession(cred, (session) => submitGruEmission(session, params));

    return prisma.inpiGru.create({
      data: {
        organizationId,
        credentialId: credentialRow?.id ?? null,
        gruNumber: result.gruNumber,
        serviceCode: params.serviceCode,
        processNumber: params.processNumber || null,
        description: params.description ?? null,
        amountCents: result.amountCents ?? null,
        barcode: result.barcode ?? null,
        status: "PENDING",
      },
    });
  }

  /** Consulta a situação de uma GRU no INPI e atualiza o registro local. */
  async consultGru(organizationId: string, gruNumber: string): Promise<GruStatusResult> {
    const cred = await this.credentials(organizationId);
    const status = await withGruSession(cred, (session) => fetchGruStatus(session, gruNumber));
    await this.upsertFromPortal(organizationId, status);
    return status;
  }

  /**
   * Sincroniza com o portal por período (traz também GRUs emitidas fora do
   * app, ex.: direto no site do INPI). Padrão: últimos 90 dias. O portal só
   * aceita ~30 dias por pesquisa (intervalos maiores retornam vazio, sem
   * erro), então o período é fatiado em janelas de 30 dias na mesma sessão.
   */
  async syncGrus(organizationId: string, range?: { from?: Date; to?: Date }): Promise<GruStatusResult[]> {
    const cred = await this.credentials(organizationId);
    const to = range?.to ?? new Date();
    const from = range?.from ?? new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);

    const DAY = 24 * 60 * 60 * 1000;
    const WINDOW = 30 * DAY;
    const rows = await withGruSession(cred, async (session) => {
      const byNumber = new Map<string, GruStatusResult>();
      for (let start = from.getTime(); start <= to.getTime(); start += WINDOW) {
        const end = Math.min(start + WINDOW - DAY, to.getTime());
        const chunk = await searchGrus(session, {
          from: toPortalDate(new Date(start)),
          to: toPortalDate(new Date(end)),
        });
        for (const row of chunk) byNumber.set(row.gruNumber, row);
      }
      return [...byNumber.values()];
    });

    for (const row of rows) {
      await this.upsertFromPortal(organizationId, row);
    }
    return rows;
  }

  /** 2ª via do boleto (PDF) direto do INPI. */
  async getBoletoPdf(organizationId: string, gruNumber: string): Promise<Buffer> {
    const cred = await this.credentials(organizationId);
    return withGruSession(cred, (session) => downloadBoletoPdf(session, gruNumber));
  }

  /** Lista as GRUs registradas pela organização (leitura local). */
  async listGrus(organizationId: string) {
    return prisma.inpiGru.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /** Grava/atualiza o registro local a partir de uma linha do portal. */
  private async upsertFromPortal(organizationId: string, row: GruStatusResult): Promise<void> {
    const existing = await prisma.inpiGru.findFirst({
      where: { organizationId, gruNumber: row.gruNumber },
      select: { id: true, paidAt: true, description: true },
    });
    const data = {
      status: row.status,
      serviceCode: row.serviceCode ?? undefined,
      amountCents: row.amountCents ?? undefined,
      // O portal não expõe a data do pagamento; marca a 1ª vez que o vimos pago.
      paidAt: row.status === "PAID" ? (existing?.paidAt ?? new Date()) : undefined,
      description: existing?.description ?? row.serviceLabel ?? undefined,
    };
    if (existing) {
      await prisma.inpiGru.update({ where: { id: existing.id }, data });
    } else {
      await prisma.inpiGru.create({
        data: { organizationId, gruNumber: row.gruNumber, ...data },
      });
    }
  }
}

export const gruService = new GruService();
export { GruRejectedError };
