export interface GenerateTextInput {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateTextOutput {
  text: string;
  model: string;
}

export interface GenerateEmbeddingInput {
  text: string;
}

export interface GenerateEmbeddingOutput {
  embedding: number[];
  model: string;
  dimensions: number;
}

/** Dimensão fixa dos vetores no banco (coluna vector(1536)). */
export const EMBEDDING_DIMENSIONS = 1536;

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number;
}

export interface Citation {
  documentId: string;
  chunkId: string;
  sourceTitle: string;
  quote: string;
  pageNumber?: number;
}

export interface RagAnswer {
  answer: string;
  citations: Citation[];
}

export interface RagQuestionInput {
  organizationId: string;
  userId: string;
  question: string;
  caseId?: string | null;
  conversationId?: string | null;
  /** Dados estruturados verificados (ex.: ferramentas internas do INPI). */
  structuredContext?: string | null;
  /** Registro das ferramentas internas executadas (auditoria). */
  toolCalls?: string[];
}

export interface RagQuestionResult extends RagAnswer {
  conversationId: string;
  messageId: string;
}

export interface TrademarkAnalysisInput {
  organizationId: string;
  userId: string;
  caseId?: string | null;
  brandName: string;
  niceClasses: string[];
  businessDescription?: string;
  similarTrademarks?: string;
  userNotes?: string;
}

export interface PatentAnalysisInput {
  organizationId: string;
  userId: string;
  caseId?: string | null;
  title: string;
  abstract?: string;
  keywords: string[];
  ipcClasses: string[];
  priorArt?: string;
}

export interface GeneratedAnalysisResult {
  generatedDocumentId: string;
  title: string;
  content: string;
  citations: Citation[];
}
