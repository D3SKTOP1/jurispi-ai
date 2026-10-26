/**
 * Extração de texto de documentos enviados.
 * Suporta: PDF (pdf-parse), TXT e Markdown.
 */

export interface ExtractedPage {
  pageNumber: number | null;
  text: string;
}

export interface ExtractionResult {
  fullText: string;
  pages: ExtractedPage[];
}

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
};

export function isAllowedMimeType(mime: string): boolean {
  return mime in ALLOWED_MIME_TYPES;
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  if (mimeType === "application/pdf") {
    return extractPdf(buffer);
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    const text = buffer.toString("utf-8");
    return { fullText: text, pages: [{ pageNumber: null, text }] };
  }

  throw new Error(`Tipo de arquivo não suportado para extração: ${mimeType}`);
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const pages: ExtractedPage[] = (result.pages ?? []).map(
      (p: { num?: number; text?: string }, index: number) => ({
        pageNumber: p.num ?? index + 1,
        text: p.text ?? "",
      })
    );
    return {
      fullText: result.text ?? pages.map((p) => p.text).join("\n\n"),
      pages: pages.length > 0 ? pages : [{ pageNumber: null, text: result.text ?? "" }],
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
