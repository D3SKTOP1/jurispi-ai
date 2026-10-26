import "server-only";

import { PePiLiveProvider, PepiUnavailableError } from "../providers/pepi-live-provider";
import { patentSearchService } from "./patent-search-service";
import { trademarkSearchService } from "./trademark-search-service";
import { cachePatents, cacheTrademarks } from "./corpus-cache";
import type {
  InpiDispatchResult,
  PatentSearchParams,
  PatentSearchResult,
  TrademarkSearchParams,
  TrademarkSearchResult,
} from "../types";

/** De onde vieram os resultados exibidos. */
export type LiveSearchOrigin = "live" | "local";

export interface LiveSearchResult<T> {
  results: T;
  origin: LiveSearchOrigin;
  /** Quando `live` foi pedido mas o pePI falhou e caímos na base local. */
  degraded: boolean;
  /** Mensagem curta do motivo do fallback (para exibir/logar). */
  notice?: string;
}

const provider = new PePiLiveProvider();

function fallbackNotice(error: unknown): string {
  if (error instanceof PepiUnavailableError) {
    return "Consulta ao vivo no INPI indisponível no momento; exibindo a base importada.";
  }
  return "Falha na consulta ao vivo; exibindo a base importada.";
}

/**
 * LiveInpiSearchService — orquestra busca AO VIVO no pePI com fallback
 * automático para a base local importada.
 *
 * - `live=false` (padrão): usa só a base local (rápido, sempre disponível).
 * - `live=true`: tenta o pePI; se falhar (timeout/instabilidade), cai na
 *   base local marcando `degraded`. A UI decide como sinalizar a origem.
 *
 * O pePI é a base oficial e completa (desde 2000), mas pode estar fora do
 * ar e a busca de patentes é lenta — por isso o fallback é obrigatório.
 */
export class LiveInpiSearchService {
  async searchTrademarks(
    params: TrademarkSearchParams,
    opts?: { live?: boolean }
  ): Promise<LiveSearchResult<TrademarkSearchResult[]>> {
    if (!opts?.live) {
      return { results: await trademarkSearchService.search(params), origin: "local", degraded: false };
    }
    try {
      const results = await provider.searchTrademark(params);
      // Cache-as-you-go: alimenta o corpus local de risco/similaridade.
      await cacheTrademarks(results);
      return { results, origin: "live", degraded: false };
    } catch (error) {
      const results = await trademarkSearchService.search(params);
      return { results, origin: "local", degraded: true, notice: fallbackNotice(error) };
    }
  }

  async searchPatents(
    params: PatentSearchParams,
    opts?: { live?: boolean }
  ): Promise<LiveSearchResult<PatentSearchResult[]>> {
    if (!opts?.live) {
      return { results: await patentSearchService.search(params), origin: "local", degraded: false };
    }
    try {
      const results = await provider.searchPatent(params);
      await cachePatents(results);
      return { results, origin: "live", degraded: false };
    } catch (error) {
      const results = await patentSearchService.search(params);
      return { results, origin: "local", degraded: true, notice: fallbackNotice(error) };
    }
  }

  /** Despachos ao vivo (detalhe do processo no pePI) com fallback à base local. */
  async getDispatches(
    processNumber: string,
    type: "TRADEMARK" | "PATENT",
    opts?: { live?: boolean }
  ): Promise<LiveSearchResult<InpiDispatchResult[]>> {
    if (opts?.live) {
      try {
        const results = await provider.getDispatches(processNumber);
        if (results.length > 0) return { results, origin: "live", degraded: false };
      } catch (error) {
        const results = await localDispatches(processNumber, type);
        return { results, origin: "local", degraded: true, notice: fallbackNotice(error) };
      }
    }
    return { results: await localDispatches(processNumber, type), origin: "local", degraded: false };
  }
}

async function localDispatches(
  processNumber: string,
  type: "TRADEMARK" | "PATENT"
): Promise<InpiDispatchResult[]> {
  const service = type === "TRADEMARK" ? trademarkSearchService : patentSearchService;
  const dispatches = await service.getDispatches(processNumber);
  return dispatches.map((d) => ({
    processNumber: d.processNumber,
    rpiNumber: d.rpiNumber,
    rpiDate: d.rpiDate,
    dispatchCode: d.dispatchCode,
    dispatchText: d.dispatchText,
    section: d.section,
    source: "Base importada (INPI)",
  }));
}

export const liveInpiSearchService = new LiveInpiSearchService();
