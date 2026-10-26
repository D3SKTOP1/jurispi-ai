import type {
  InpiDispatchResult,
  InpiProcessResult,
  PatentSearchParams,
  PatentSearchResult,
  TrademarkSearchParams,
  TrademarkSearchResult,
} from "./types";

/**
 * Interface base dos providers de dados do INPI.
 *
 * Implementações vivas: `OpenDataProvider` (base local importada) e
 * `PePiLiveProvider` (consulta ao vivo no pePI). Os serviços instanciam o
 * provider concreto que precisam — não há factory: cada caso de uso sabe
 * qual fonte quer (ao vivo com fallback, ou só local).
 */
export interface InpiProvider {
  sourceName: string;

  searchTrademark(params: TrademarkSearchParams): Promise<TrademarkSearchResult[]>;

  searchPatent(params: PatentSearchParams): Promise<PatentSearchResult[]>;

  getProcess(processNumber: string): Promise<InpiProcessResult | null>;

  getDispatches(processNumber: string): Promise<InpiDispatchResult[]>;
}
