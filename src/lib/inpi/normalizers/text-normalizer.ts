/**
 * Normalização de texto para busca: minúsculas, sem acentos,
 * sem pontuação e com espaços colapsados. O valor normalizado é
 * gravado nas colunas *normalized* e indexado com pg_trgm — assim a
 * busca não depende de unaccent() em tempo de query.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Radical simples: primeiro token com pelo menos 4 caracteres (ou o maior). */
export function radicalOf(value: string): string {
  const tokens = normalizeText(value).split(" ").filter(Boolean);
  const strong = tokens.find((t) => t.length >= 4);
  return strong ?? tokens.sort((a, b) => b.length - a.length)[0] ?? "";
}

/** Normaliza número de processo: só dígitos/letras maiúsculas, sem separadores. */
export function normalizeProcessNumber(value: string): string {
  return value.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

export function parseDateSafe(value: string | undefined | null): Date | null {
  if (!value) return null;
  // Aceita dd/mm/aaaa e ISO.
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : value.trim();
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
