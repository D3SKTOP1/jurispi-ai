import type { InpiProvider } from "../inpi-provider";
import { normalizeText, parseDateSafe } from "../normalizers/text-normalizer";
import {
  PepiUnavailableError,
  fetchHolderMatches,
  fetchHolderTrademarks,
  fetchPatentDetail,
  fetchPatentsByExpression,
  fetchPatentsByNumbers,
  fetchTrademarkDetail,
  fetchTrademarksByName,
  fetchTrademarksByNumbers,
  withPepiSession,
  type PatentSearchColumn,
  type PepiSession,
} from "../pepi/pepi-client";
import {
  extractClassCodes,
  parseHolderMatches,
  parsePatentDetail,
  parsePatentRows,
  parseResultMeta,
  parseTrademarkDetail,
  parseTrademarkRows,
  type PepiDispatchRow,
} from "../pepi/pepi-parser";
import type {
  InpiDispatchResult,
  InpiProcessResult,
  PatentSearchParams,
  PatentSearchResult,
  TrademarkSearchParams,
  TrademarkSearchResult,
} from "../types";

export const PEPI_SOURCE = "pePI ao vivo (busca.inpi.gov.br)";

/**
 * PePiLiveProvider — consulta AO VIVO a base pública do INPI (pePI),
 * a mesma que o site oficial usa. Sem login, sem captcha: sessão anônima.
 *
 * Diferente dos demais providers (que leem a base local importada), este
 * vai ao INPI a cada chamada. Use para consultas pontuais do usuário e
 * sempre com fallback para a base local — o pePI tem indisponibilidades.
 * A cobertura é a oficial e completa (desde 2000), inclusive processos
 * recém-depositados que ainda não entraram nos Dados Abertos/RPI.
 */
export class PePiLiveProvider implements InpiProvider {
  sourceName = PEPI_SOURCE;

  async searchTrademark(params: TrademarkSearchParams): Promise<TrademarkSearchResult[]> {
    const limit = Math.min(params.limit ?? 50, 100);
    return withPepiSession(async (session) => {
      // 1. Número de processo é a busca mais específica.
      if (params.processNumber) {
        const html = await fetchTrademarksByNumbers(session, {
          processNumber: params.processNumber,
        });
        return mapTrademarkRows(html, limit);
      }
      // 2. Nome da marca (com classe opcional).
      if (params.query) {
        const html = await fetchTrademarksByName(session, {
          name: params.query,
          exact: params.mode === "exact",
          niceClass: params.niceClass,
          perPage: limit,
        });
        return mapTrademarkRows(html, limit);
      }
      return [];
    });
  }

  async searchPatent(params: PatentSearchParams): Promise<PatentSearchResult[]> {
    const limit = Math.min(params.limit ?? 50, 100);
    return withPepiSession(async (session) => {
      if (params.processNumber) {
        const html = await fetchPatentsByNumbers(session, {
          processNumber: params.processNumber,
        });
        return mapPatentRows(html, limit);
      }
      const { expression, column } = choosePatentQuery(params);
      if (!expression) return [];
      const html = await fetchPatentsByExpression(session, { expression, column, perPage: limit });
      return mapPatentRows(html, limit);
    });
  }

  /**
   * Passo 1 da importação por titular: lista os titulares que casam com o
   * CNPJ/nome (o pePI agrupa por titular). Cada um tem `pos` para expandir.
   */
  async searchTrademarkHolders(query: string): Promise<Array<{ pos: number; name: string }>> {
    const isDocument = (query.replace(/\D/g, "").length >= 11);
    return withPepiSession(async (session) => {
      const html = await fetchHolderMatches(session, {
        holder: isDocument ? undefined : query,
        document: isDocument ? query : undefined,
        perPage: 100,
      });
      return parseHolderMatches(html);
    });
  }

  /**
   * Passo 2: lista as marcas de um titular específico (`pos`). Refaz a busca
   * de titular na MESMA sessão (o pePI guarda o resultado por sessão) e então
   * abre o titular pela posição.
   */
  async listHolderTrademarks(query: string, pos: number): Promise<TrademarkSearchResult[]> {
    const isDocument = (query.replace(/\D/g, "").length >= 11);
    return withPepiSession(async (session) => {
      await fetchHolderMatches(session, {
        holder: isDocument ? undefined : query,
        document: isDocument ? query : undefined,
        perPage: 100,
      });
      const html = await fetchHolderTrademarks(session, pos);
      return mapTrademarkRows(html, 200);
    });
  }

  async getProcess(processNumber: string): Promise<InpiProcessResult | null> {
    return withPepiSession(async (session) => {
      const trademark = await this.trademarkDetailByProcess(session, processNumber);
      if (trademark) {
        return { processNumber: trademark.processNumber, kind: "TRADEMARK", trademark };
      }
      const patent = await this.patentDetailByProcess(session, processNumber);
      if (patent) {
        return { processNumber: patent.processNumber, kind: "PATENT", patent };
      }
      return null;
    });
  }

  async getDispatches(processNumber: string): Promise<InpiDispatchResult[]> {
    return withPepiSession(async (session) => {
      const tmCod = await this.trademarkCodByProcess(session, processNumber);
      if (tmCod) {
        const detail = parseTrademarkDetail(await fetchTrademarkDetail(session, tmCod));
        if (detail) return mapDispatches(detail.processNumber, detail.dispatches);
      }
      const ptCod = await this.patentCodByProcess(session, processNumber);
      if (ptCod) {
        const detail = parsePatentDetail(await fetchPatentDetail(session, ptCod));
        if (detail) return mapDispatches(detail.processNumber, detail.dispatches);
      }
      return [];
    });
  }

  // -- helpers de detalhe --------------------------------------------------

  private async trademarkCodByProcess(
    session: PepiSession,
    processNumber: string
  ): Promise<string | null> {
    const html = await fetchTrademarksByNumbers(session, { processNumber });
    return parseTrademarkRows(html)[0]?.codPedido ?? null;
  }

  private async trademarkDetailByProcess(
    session: PepiSession,
    processNumber: string
  ): Promise<TrademarkSearchResult | null> {
    const cod = await this.trademarkCodByProcess(session, processNumber);
    if (!cod) return null;
    const detail = parseTrademarkDetail(await fetchTrademarkDetail(session, cod));
    if (!detail) return null;
    return {
      id: `pepi:tm:${cod}`,
      processNumber: detail.processNumber,
      brandName: detail.brandName ?? "",
      normalizedName: normalizeText(detail.brandName ?? ""),
      holderName: detail.holders[0] ?? null,
      presentation: detail.presentation,
      nature: detail.nature,
      status: detail.status,
      applicationDate: parseDateSafe(detail.depositDate),
      registrationDate: parseDateSafe(detail.grantDate),
      niceClasses: [...new Set(detail.classes.flatMap((c) => extractClassCodes(c.code)))],
      source: PEPI_SOURCE,
      sourceUpdatedAt: new Date(),
    };
  }

  private async patentCodByProcess(
    session: PepiSession,
    processNumber: string
  ): Promise<string | null> {
    const html = await fetchPatentsByNumbers(session, { processNumber });
    return parsePatentRows(html)[0]?.codPedido ?? null;
  }

  private async patentDetailByProcess(
    session: PepiSession,
    processNumber: string
  ): Promise<PatentSearchResult | null> {
    const cod = await this.patentCodByProcess(session, processNumber);
    if (!cod) return null;
    const detail = parsePatentDetail(await fetchPatentDetail(session, cod));
    if (!detail) return null;
    return {
      id: `pepi:pt:${cod}`,
      processNumber: detail.processNumber,
      title: detail.title ?? "",
      abstractText: detail.abstractText,
      status: null,
      applicationDate: parseDateSafe(detail.depositDate),
      publicationDate: parseDateSafe(detail.publicationDate),
      grantDate: parseDateSafe(detail.grantDate),
      ipcClasses: detail.ipcClasses,
      applicants: detail.applicants,
      inventors: detail.inventors,
      source: PEPI_SOURCE,
      sourceUpdatedAt: new Date(),
    };
  }
}

// ---------------------------------------------------------------------------
// Mapeadores pePI → tipos da aplicação
// ---------------------------------------------------------------------------

function mapTrademarkRows(html: string, limit: number): TrademarkSearchResult[] {
  const meta = parseResultMeta(html);
  if (meta.noResults) return [];
  return parseTrademarkRows(html)
    .slice(0, limit)
    .map((row) => ({
      id: `pepi:tm:${row.codPedido}`,
      processNumber: row.processNumber,
      brandName: row.brandName,
      normalizedName: normalizeText(row.brandName),
      holderName: row.holderName,
      presentation: row.presentation,
      nature: null,
      status: row.status,
      applicationDate: parseDateSafe(row.priorityDate),
      registrationDate: null,
      niceClasses: extractClassCodes(row.classText),
      source: PEPI_SOURCE,
      sourceUpdatedAt: new Date(),
    }));
}

function mapPatentRows(html: string, limit: number): PatentSearchResult[] {
  const meta = parseResultMeta(html);
  if (meta.noResults) return [];
  return parsePatentRows(html)
    .slice(0, limit)
    .map((row) => ({
      id: `pepi:pt:${row.codPedido}`,
      processNumber: row.processNumber,
      title: row.title,
      abstractText: null,
      status: null,
      applicationDate: parseDateSafe(row.depositDate),
      publicationDate: null,
      grantDate: null,
      ipcClasses: row.ipcText ? [row.ipcText] : [],
      applicants: [],
      inventors: [],
      source: PEPI_SOURCE,
      sourceUpdatedAt: new Date(),
    }));
}

function mapDispatches(processNumber: string, rows: PepiDispatchRow[]): InpiDispatchResult[] {
  return rows.map((d) => ({
    processNumber,
    rpiNumber: d.rpiNumber,
    rpiDate: parseDateSafe(d.rpiDate),
    dispatchCode: d.dispatchCode,
    dispatchText: [d.dispatchDescription, d.complement].filter(Boolean).join(" — ") || "",
    section: null,
    source: PEPI_SOURCE,
  }));
}

/** Escolhe a coluna de busca de patente conforme o parâmetro preenchido. */
function choosePatentQuery(params: PatentSearchParams): {
  expression: string;
  column: PatentSearchColumn;
} {
  if (params.applicant) return { expression: params.applicant, column: "NomeDepositante" };
  if (params.inventor) return { expression: params.inventor, column: "NomeInventor" };
  return { expression: params.query ?? "", column: "Titulo" };
}

export { PepiUnavailableError };
