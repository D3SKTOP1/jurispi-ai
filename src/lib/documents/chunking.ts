import type { ExtractionResult } from "./text-extraction";

export interface TextChunk {
  content: string;
  pageNumber: number | null;
  chunkIndex: number;
}

const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 200;

/**
 * Divide o texto extraído em chunks de ~1200 caracteres com sobreposição,
 * preservando parágrafos quando possível e o número da página de origem.
 */
export function chunkExtraction(extraction: ExtractionResult): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  for (const page of extraction.pages) {
    const text = normalize(page.text);
    if (!text) continue;

    for (const piece of splitText(text)) {
      chunks.push({ content: piece, pageNumber: page.pageNumber, chunkIndex });
      chunkIndex += 1;
    }
  }

  return chunks;
}

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function splitText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const pieces: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) pieces.push(trimmed);
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > CHUNK_SIZE) {
      flush();
      // Parágrafo gigante: corta por tamanho fixo com sobreposição.
      for (let start = 0; start < paragraph.length; start += CHUNK_SIZE - CHUNK_OVERLAP) {
        pieces.push(paragraph.slice(start, start + CHUNK_SIZE).trim());
      }
      continue;
    }

    if (current.length + paragraph.length + 2 > CHUNK_SIZE) {
      flush();
      // Sobreposição: carrega o final do chunk anterior.
      const prev = pieces[pieces.length - 1];
      if (prev) current = prev.slice(-CHUNK_OVERLAP) + "\n";
    }
    current += (current ? "\n\n" : "") + paragraph;
  }
  flush();

  return pieces.filter(Boolean);
}
