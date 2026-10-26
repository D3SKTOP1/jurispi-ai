/**
 * Tipos compartilhados da camada de integração INPI.
 *
 * Arquitetura:
 *   Fontes oficiais → download controlado → staging (raw) → parsing →
 *   normalização → tabelas globais → índices (trgm/FTS/vector) →
 *   serviços de busca → ferramentas da IA → UI/alertas/pareceres.
 *
 * Dados do INPI são GLOBAIS (não pertencem a nenhuma organização).
 * Monitoramento, alertas e análises são TENANT-SPECIFIC.
 */

export type InpiEntityType = "TRADEMARK" | "PATENT" | "RPI_DISPATCH";

export type ImportJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type RawRecordStatus = "PENDING" | "NORMALIZED" | "FAILED" | "SKIPPED";

// ---------------------------------------------------------------------------
// Busca de marcas
// ---------------------------------------------------------------------------

export interface TrademarkSearchParams {
  query?: string;
  niceClass?: string;
  holder?: string;
  processNumber?: string;
  status?: string;
  /** exact = nome exato normalizado; similar = pg_trgm */
  mode?: "exact" | "similar" | "prefix";
  threshold?: number;
  limit?: number;
  offset?: number;
}

export interface TrademarkSearchResult {
  id: string;
  processNumber: string;
  brandName: string;
  normalizedName: string;
  holderName: string | null;
  presentation: string | null;
  nature: string | null;
  status: string | null;
  applicationDate: Date | null;
  registrationDate: Date | null;
  niceClasses: string[];
  /** Similaridade trigram 0..1 quando a busca é por similaridade. */
  similarity?: number;
  source: string;
  sourceUpdatedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Busca de patentes
// ---------------------------------------------------------------------------

export interface PatentSearchParams {
  query?: string;
  ipc?: string;
  applicant?: string;
  inventor?: string;
  processNumber?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface PatentSearchResult {
  id: string;
  processNumber: string;
  title: string;
  abstractText: string | null;
  status: string | null;
  applicationDate: Date | null;
  publicationDate: Date | null;
  grantDate: Date | null;
  ipcClasses: string[];
  applicants: string[];
  inventors: string[];
  /** Ranking full-text quando a busca é textual. */
  rank?: number;
  source: string;
  sourceUpdatedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Processo e despachos (visão unificada dos providers)
// ---------------------------------------------------------------------------

export interface InpiProcessResult {
  processNumber: string;
  kind: "TRADEMARK" | "PATENT";
  trademark?: TrademarkSearchResult;
  patent?: PatentSearchResult;
}

export interface InpiDispatchResult {
  processNumber: string;
  rpiNumber: string | null;
  rpiDate: Date | null;
  dispatchCode: string | null;
  dispatchText: string;
  section: string | null;
  source: string;
}

// ---------------------------------------------------------------------------
// Análise de risco de marca
// ---------------------------------------------------------------------------

export interface TrademarkRiskInput {
  brandName: string;
  niceClasses: string[];
  holderName?: string;
  /** Limite de marcas similares consideradas. */
  limit?: number;
}

export type RiskLevelLabel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export interface TrademarkRiskResult {
  riskLevel: RiskLevelLabel;
  score: number;
  reasons: string[];
  similarMarks: TrademarkSearchResult[];
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Registros brutos parseados (staging → normalização)
// ---------------------------------------------------------------------------

export interface ParsedTrademarkRecord {
  processNumber: string;
  brandName: string;
  holderName?: string;
  holderDocument?: string;
  presentation?: string;
  nature?: string;
  status?: string;
  applicationDate?: string;
  registrationDate?: string;
  expirationDate?: string;
  niceClasses?: Array<{ niceClass: string; specification?: string }>;
  applicants?: Array<{ name: string; document?: string; country?: string }>;
}

export interface ParsedPatentRecord {
  processNumber: string;
  title: string;
  abstractText?: string;
  status?: string;
  applicationDate?: string;
  publicationDate?: string;
  grantDate?: string;
  expirationDate?: string;
  ipcClasses?: string[];
  applicants?: Array<{ name: string; document?: string; country?: string }>;
  inventors?: Array<{ name: string; country?: string }>;
}

export interface ParsedRpiDispatchRecord {
  processNumber: string;
  dispatchCode?: string;
  dispatchText: string;
  holderName?: string;
  title?: string;
  entityKind?: "TRADEMARK" | "PATENT";
}

export interface ParsedRpiFile {
  rpiNumber: string;
  publishedAt?: string;
  sectionCode: string;
  sectionName?: string;
  dispatches: ParsedRpiDispatchRecord[];
}

export const INPI_DISCLAIMER =
  "Análise assistiva gerada pela plataforma com base em dados públicos importados do INPI. " +
  "Não substitui busca oficial, parecer jurídico ou avaliação de agente da propriedade industrial.";
