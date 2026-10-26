import { extractText } from "@/lib/documents/text-extraction";

/**
 * Parser de PDF da RPI — fallback quando não há XML/TXT.
 * O PDF é a referência oficial de exibição; para parsing estruturado
 * a plataforma prioriza XML/TXT. Aqui extraímos apenas o texto bruto
 * e tentamos identificar despachos por heurística de número de processo.
 */
export interface PdfDispatchCandidate {
  processNumber: string;
  snippet: string;
}

const PROCESS_NUMBER_RE = /\b(\d{9}|BR\s?\d{2}\s?\d{4}\s?\d{6}[-\s]?\d?)\b/g;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await extractText(buffer, "application/pdf");
  return result.fullText;
}

export function findDispatchCandidates(fullText: string): PdfDispatchCandidate[] {
  const candidates: PdfDispatchCandidate[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(PROCESS_NUMBER_RE);
  while ((match = re.exec(fullText)) !== null && candidates.length < 500) {
    const start = Math.max(0, match.index - 80);
    const end = Math.min(fullText.length, match.index + 240);
    candidates.push({
      processNumber: match[1].replace(/[\s-]/g, ""),
      snippet: fullText.slice(start, end).replace(/\s+/g, " ").trim(),
    });
  }
  return candidates;
}
