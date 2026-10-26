import { prisma } from "@/lib/db";

import { trademarkSearchService } from "../search/trademark-search-service";
import { patentSearchService } from "../search/patent-search-service";
import { liveInpiSearchService } from "../search/live-search-service";
import { normalizeProcessNumber } from "../normalizers/text-normalizer";
import type {
  PatentSearchResult,
  TrademarkRiskInput,
  TrademarkRiskResult,
  TrademarkSearchResult,
} from "../types";

/**
 * Ferramentas internas da IA sobre a base INPI.
 *
 * Princípio: a IA NÃO inventa dados do INPI — antes de responder, as
 * ferramentas consultam as tabelas globais (estruturadas) e o resultado
 * é injetado no prompt como contexto verificável, com fonte e data de
 * importação. O RAG cobre documentos/textos; dados estruturados
 * (processo, status, titular, classe, despacho) vêm SEMPRE daqui.
 */

// ---------------------------------------------------------------------------
// Tools individuais
// ---------------------------------------------------------------------------

export async function searchTrademarkTool(name: string): Promise<TrademarkSearchResult[]> {
  return trademarkSearchService.searchExactBrandName(name);
}

export async function searchTrademarkSimilarityTool(
  name: string,
  options?: { threshold?: number; limit?: number }
): Promise<TrademarkSearchResult[]> {
  return trademarkSearchService.searchSimilarBrandNames(name, options);
}

/** Detalhe do processo por número: AO VIVO no INPI, com fallback local. */
export async function getTrademarkDetailsTool(processNumber: string) {
  const { results } = await liveInpiSearchService.searchTrademarks(
    { processNumber },
    { live: true }
  );
  return results[0] ?? null;
}

export async function getTrademarkDispatchesTool(processNumber: string) {
  const { results } = await liveInpiSearchService.getDispatches(processNumber, "TRADEMARK", {
    live: true,
  });
  return results;
}

export async function analyzeTrademarkRiskTool(
  input: TrademarkRiskInput
): Promise<TrademarkRiskResult> {
  return trademarkSearchService.analyzeTrademarkRisk(input);
}

export async function searchPatentTool(query: string): Promise<PatentSearchResult[]> {
  return patentSearchService.searchPatentText(query, 10);
}

/** Detalhe da patente por número: AO VIVO no INPI, com fallback local. */
export async function getPatentDetailsTool(processNumber: string) {
  const { results } = await liveInpiSearchService.searchPatents({ processNumber }, { live: true });
  return results[0] ?? null;
}

export async function getPatentDispatchesTool(processNumber: string) {
  const { results } = await liveInpiSearchService.getDispatches(processNumber, "PATENT", {
    live: true,
  });
  return results;
}

export async function analyzePatentTool(query: string) {
  return patentSearchService.preparePatentSemanticSearch(query);
}

export async function getRpiDispatchTool(processNumber: string) {
  return prisma.rpiDispatch.findMany({
    where: { processNumber: normalizeProcessNumber(processNumber) },
    include: { rpiSection: { include: { rpiIssue: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

/** Tenant-specific: registra um processo para monitoramento na RPI. */
export async function monitorProcessTool(input: {
  organizationId: string;
  processNumber: string;
  type: "TRADEMARK" | "PATENT";
  title?: string;
  clientId?: string | null;
  caseId?: string | null;
}) {
  const processNumber = normalizeProcessNumber(input.processNumber);
  return prisma.monitoredProcess.upsert({
    where: {
      organizationId_processNumber: {
        organizationId: input.organizationId,
        processNumber,
      },
    },
    create: {
      organizationId: input.organizationId,
      processNumber,
      type: input.type,
      title: input.title ?? null,
      clientId: input.clientId ?? null,
      caseId: input.caseId ?? null,
    },
    update: { isActive: true, title: input.title ?? undefined },
  });
}

// ---------------------------------------------------------------------------
// Orquestração: extrai entidades da pergunta, executa as tools relevantes
// e monta o bloco de contexto estruturado para o prompt.
// ---------------------------------------------------------------------------

interface ExtractedEntities {
  processNumbers: string[];
  niceClasses: string[];
  brandCandidates: string[];
  wantsRisk: boolean;
  patentIntent: boolean;
  trademarkIntent: boolean;
}

const STOPWORDS_AFTER_BRAND = new Set([
  "tem",
  "teria",
  "têm",
  "na",
  "no",
  "nas",
  "nos",
  "em",
  "para",
  "é",
  "e",
  "seria",
  "corre",
  "apresenta",
  "possui",
  "com",
  "pode",
  "está",
  "esta",
  "foi",
  "ser",
  "risco",
  "da",
  "do",
  "de",
]);

export function extractInpiEntities(question: string): ExtractedEntities {
  const processNumbers = [
    ...question.matchAll(/\b(BR\s?\d{2}\s?\d{4}\s?\d{5,7}[-\s]?\d?|\d{9})\b/gi),
  ].map((m) => m[1]);

  const niceClasses = [...question.matchAll(/classe(?:s)?\s*(?:nice\s*)?(\d{1,2})/gi)].map((m) =>
    m[1].padStart(2, "0")
  );

  const brandCandidates: string[] = [];
  // Nomes entre aspas.
  for (const m of question.matchAll(/["'“”]([^"'“”]{2,60})["'“”]/g)) {
    brandCandidates.push(m[1].trim());
  }
  // Padrão "marca X ..." — captura tokens até stopword.
  for (const m of question.matchAll(/\bmarca\s+([A-Za-zÀ-ÿ0-9][\wÀ-ÿ&.-]*(?:\s+[A-Za-zÀ-ÿ0-9][\wÀ-ÿ&.-]*){0,3})/gi)) {
    const tokens = m[1].split(/\s+/);
    const kept: string[] = [];
    for (const token of tokens) {
      if (STOPWORDS_AFTER_BRAND.has(token.toLowerCase())) break;
      kept.push(token);
    }
    if (kept.length > 0) brandCandidates.push(kept.join(" "));
  }

  return {
    processNumbers: [...new Set(processNumbers)],
    niceClasses: [...new Set(niceClasses)],
    brandCandidates: [...new Set(brandCandidates)].slice(0, 3),
    wantsRisk: /\brisco|colid|colis[aã]o|viabilidade|conflito|registr[aá]vel\b/i.test(question),
    patentIntent: /\bpatente|anteriorid|inven[cç][aã]o|ipc\b/i.test(question),
    trademarkIntent: /\bmarca|nice|colid|titular\b/i.test(question),
  };
}

export interface InpiToolContext {
  /** Bloco de texto com dados estruturados verificados, para o prompt. */
  context: string;
  /** Registro das tools executadas (auditoria/metadata da mensagem). */
  toolCalls: string[];
  usedInpiData: boolean;
}

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("pt-BR") : "não informada";
}

function fmtTrademark(t: TrademarkSearchResult): string {
  return (
    `- ${t.brandName} — processo ${t.processNumber}; titular: ${t.holderName ?? "não informado"}; ` +
    `classes Nice: ${t.niceClasses.join(", ") || "—"}; status: ${t.status ?? "não informado"}; ` +
    `depósito: ${fmtDate(t.applicationDate)}` +
    (t.similarity !== undefined ? `; similaridade: ${(t.similarity * 100).toFixed(0)}%` : "") +
    ` [fonte: ${t.source}; última importação: ${fmtDate(t.sourceUpdatedAt)}]`
  );
}

function fmtPatent(p: PatentSearchResult): string {
  return (
    `- ${p.title} — processo ${p.processNumber}; IPC: ${p.ipcClasses.join(", ") || "—"}; ` +
    `depositante(s): ${p.applicants.join(", ") || "—"}; status: ${p.status ?? "não informado"}; ` +
    `depósito: ${fmtDate(p.applicationDate)} [fonte: ${p.source}; última importação: ${fmtDate(p.sourceUpdatedAt)}]`
  );
}

/**
 * Executa as ferramentas internas pertinentes à pergunta e devolve o
 * contexto estruturado. Retorna contexto vazio quando a pergunta não
 * envolve dados do INPI.
 */
export async function buildInpiToolContext(question: string): Promise<InpiToolContext> {
  const entities = extractInpiEntities(question);
  const toolCalls: string[] = [];
  const sections: string[] = [];

  // 1. Números de processo citados → detalhes + despachos.
  for (const processNumber of entities.processNumbers.slice(0, 3)) {
    const trademark = await getTrademarkDetailsTool(processNumber);
    if (trademark) {
      toolCalls.push(`getTrademarkDetailsTool("${processNumber}")`);
      sections.push(`Processo de marca ${processNumber}:\n${fmtTrademark(trademark)}`);
    }
    const patent = await getPatentDetailsTool(processNumber);
    if (patent) {
      toolCalls.push(`getPatentDetailsTool("${processNumber}")`);
      sections.push(`Processo de patente ${processNumber}:\n${fmtPatent(patent)}`);
    }
    const rpiDispatches = await getRpiDispatchTool(processNumber);
    if (rpiDispatches.length > 0) {
      toolCalls.push(`getRpiDispatchTool("${processNumber}")`);
      sections.push(
        `Despachos publicados na RPI para ${processNumber}:\n` +
          rpiDispatches
            .slice(0, 5)
            .map(
              (d) =>
                `- RPI ${d.rpiSection.rpiIssue.number} (${fmtDate(d.rpiSection.rpiIssue.publishedAt)}), seção ${d.rpiSection.sectionCode}, código ${d.dispatchCode ?? "s/c"}: ${d.dispatchText.slice(0, 220)}`
            )
            .join("\n")
      );
    }
  }

  // 2. Nomes de marca citados → busca exata + similaridade (+ risco).
  for (const brand of entities.brandCandidates) {
    const similar = await searchTrademarkSimilarityTool(brand, { limit: 8 });
    toolCalls.push(`searchTrademarkSimilarityTool("${brand}")`);
    if (similar.length > 0) {
      sections.push(
        `Marcas na base importada semelhantes a "${brand}":\n` +
          similar.map(fmtTrademark).join("\n")
      );
    } else {
      sections.push(
        `Nenhuma marca semelhante a "${brand}" na base importada (cobertura pode ser parcial).`
      );
    }

    if (entities.wantsRisk) {
      const risk = await analyzeTrademarkRiskTool({
        brandName: brand,
        niceClasses: entities.niceClasses,
      });
      toolCalls.push(
        `analyzeTrademarkRiskTool({ brandName: "${brand}", niceClasses: [${entities.niceClasses.join(", ")}] })`
      );
      sections.push(
        `Análise preliminar de risco para "${brand}"${entities.niceClasses.length ? ` (classes ${entities.niceClasses.join(", ")})` : ""}:\n` +
          `- Nível: ${risk.riskLevel} (score ${risk.score}/100)\n` +
          risk.reasons.map((r) => `- ${r}`).join("\n")
      );
    }
  }

  // 3. Classe citada sem marca → panorama da classe.
  if (
    entities.niceClasses.length > 0 &&
    entities.brandCandidates.length === 0 &&
    entities.trademarkIntent
  ) {
    for (const cls of entities.niceClasses.slice(0, 2)) {
      const inClass = await trademarkSearchService.searchTrademarkByClass(cls);
      toolCalls.push(`searchTrademarkByClass("${cls}")`);
      if (inClass.length > 0) {
        sections.push(
          `Marcas importadas na classe ${cls} (amostra):\n` +
            inClass.slice(0, 8).map(fmtTrademark).join("\n")
        );
      }
    }
  }

  // 4. Intenção de patente com termo de busca → full-text.
  if (entities.patentIntent && entities.processNumbers.length === 0) {
    const cleaned = question.replace(/[?!.]/g, " ").slice(0, 200);
    const patents = await searchPatentTool(cleaned);
    if (patents.length > 0) {
      toolCalls.push(`searchPatentTool("${cleaned.slice(0, 60)}…")`);
      sections.push(
        `Patentes na base importada relacionadas ao tema:\n` +
          patents.slice(0, 6).map(fmtPatent).join("\n")
      );
    }
  }

  if (sections.length === 0) {
    return { context: "", toolCalls, usedInpiData: false };
  }

  return {
    usedInpiData: true,
    toolCalls,
    context:
      `Ferramentas executadas: ${toolCalls.join("; ")}\n\n` + sections.join("\n\n"),
  };
}
