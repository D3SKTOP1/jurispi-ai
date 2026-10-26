import Papa from "papaparse";

/**
 * Parser CSV para arquivos de dados abertos do INPI.
 * Tolera encoding problemático (latin1/utf-8), delimitadores ; ou ,
 * e cabeçalhos com espaços/acentos.
 */
export interface CsvParseResult {
  rows: Array<Record<string, string>>;
  errors: string[];
}

export function parseCsv(buffer: Buffer): CsvParseResult {
  let text = buffer.toString("utf-8");
  // Heurística de encoding: se houver muitos caracteres de substituição, tenta latin1.
  if ((text.match(/�/g)?.length ?? 0) > 5) {
    text = buffer.toString("latin1");
  }

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: "", // autodetecta , ou ;
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  return {
    rows: (result.data ?? []).filter((row) => Object.values(row).some((v) => v?.trim())),
    errors: (result.errors ?? []).slice(0, 10).map((e) => `${e.type}: ${e.message} (linha ${e.row})`),
  };
}
