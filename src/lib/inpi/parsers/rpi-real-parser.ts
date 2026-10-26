import { XMLParser } from "fast-xml-parser";

/**
 * Parser dos arquivos XML REAIS da RPI (revistas.inpi.gov.br/txt/*.zip).
 *
 * Três schemas distintos, um por revista:
 *
 * RM (Marcas) — centrado em <processo>:
 *   <revista numero="2896" data="07/07/2026">
 *     <processo numero="..." data-deposito="..." data-concessao="..." data-vigencia="...">
 *       <despachos><despacho codigo="IPAS029" nome="Deferimento do pedido">
 *         <texto-complementar>…</texto-complementar>
 *         <protocolo …><requerente nome-razao-social="…"/></protocolo>
 *       </despacho></despachos>
 *       <titulares><titular nome-razao-social="…" pais="BR" uf="SP"/></titulares>
 *       <marca apresentacao="Nominativa" natureza="…"><nome>…</nome></marca>
 *       <lista-classe-nice><classe-nice codigo="31"><especificacao>…</especificacao></classe-nice></lista-classe-nice>
 *       <procurador>…</procurador>
 *     </processo>
 *   </revista>
 *
 * P (Patentes) e PC (Programa de computador) — centrados em <despacho>:
 *   <revista numero="2896" dataPublicacao="07/07/2026" diretoria="Patente">
 *     <despacho>
 *       <codigo>100.1</codigo>
 *       <titulo>…</titulo>
 *       <processo-patente|processo-programa>
 *         <numero inid="21">BR 10 2012 008876-2</numero>
 *         <titulo inid="54">…</titulo>
 *         <data-deposito inid="22">16/04/2012</data-deposito>
 *         <titular-lista|titularLista>…</…>
 *       </…>
 *       <comentario inid="co">…</comentario>
 *     </despacho>
 *   </revista>
 *
 * Os arquivos de marcas passam de 50 MB — o parsing é feito por chunks
 * (um <processo>/<despacho> por vez), permitindo processar fatias
 * (cursor/limit) dentro do tempo de uma função serverless.
 */

export type RevistaKind = "RM" | "P" | "PC";

export interface RealRpiHeader {
  rpiNumber: string;
  /** Data de publicação como impressa no XML (dd/mm/aaaa). */
  publishedAt?: string;
}

export interface RealDispatchRecord {
  processNumber: string;
  dispatchCode?: string;
  dispatchText: string;
  holderName?: string;
  title?: string;
  entityKind: "TRADEMARK" | "PATENT" | "SOFTWARE";
}

export interface TrademarkSnapshot {
  processNumber: string;
  brandName?: string;
  presentation?: string;
  nature?: string;
  holderName?: string;
  holderCountry?: string;
  status?: string;
  applicationDate?: string;
  registrationDate?: string;
  expirationDate?: string;
  attorney?: string;
  niceClasses: Array<{ niceClass: string; specification?: string }>;
  applicants: Array<{ name: string; country?: string }>;
}

export interface PatentSnapshot {
  processNumber: string;
  title?: string;
  applicationDate?: string;
  status?: string;
  ipcCodes: string[];
  applicants: Array<{ name: string; country?: string }>;
  inventors: string[];
}

export interface ParsedRealEntry {
  dispatches: RealDispatchRecord[];
  trademark?: TrademarkSnapshot;
  patent?: PatentSnapshot;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // Mantém tudo como string: números de processo têm zeros à esquerda
  // e classes Nice ("05") não podem virar Number.
  parseTagValue: false,
  parseAttributeValue: false,
});

/* eslint-disable @typescript-eslint/no-explicit-any */

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Extrai texto de um nó que pode ser string ou objeto com #text. */
function textOf(value: any): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in value) return String(value["#text"]).trim();
  return "";
}

/** Cabeçalho da revista sem parsear o arquivo inteiro. */
export function parseRealRpiHeader(xml: string): RealRpiHeader {
  const head = xml.slice(0, 600);
  const numero = /numero="(\d+)"/.exec(head)?.[1];
  const data = /(?:data|dataPublicacao)="([^"]+)"/.exec(head)?.[1];
  if (!numero) {
    throw new Error("XML da RPI em formato não reconhecido (atributo numero ausente na <revista>).");
  }
  return { rpiNumber: numero, publishedAt: data };
}

/**
 * Delimita os chunks (offsets de início/fim) de cada registro do XML.
 * RM → <processo …>…</processo>; P/PC → <despacho>…</despacho>.
 * Barato o suficiente para rodar a cada fatia (varredura por indexOf).
 */
export function scanRealRpiChunks(xml: string, kind: RevistaKind): Array<[number, number]> {
  const open = kind === "RM" ? "<processo " : "<despacho>";
  const close = kind === "RM" ? "</processo>" : "</despacho>";
  const chunks: Array<[number, number]> = [];
  let pos = 0;
  for (;;) {
    const start = xml.indexOf(open, pos);
    if (start === -1) break;
    const end = xml.indexOf(close, start);
    if (end === -1) break;
    chunks.push([start, end + close.length]);
    pos = end + close.length;
  }
  return chunks;
}

/** Parseia um intervalo [cursor, cursor+limit) de chunks. */
export function parseRealRpiSlice(
  xml: string,
  kind: RevistaKind,
  chunks: Array<[number, number]>,
  cursor: number,
  limit: number
): ParsedRealEntry[] {
  const slice = chunks.slice(cursor, cursor + limit);
  const entries: ParsedRealEntry[] = [];
  for (const [start, end] of slice) {
    const chunk = xml.slice(start, end);
    try {
      const entry =
        kind === "RM" ? parseRmChunk(chunk) : parseDespachoChunk(chunk, kind);
      if (entry) entries.push(entry);
    } catch {
      // Chunk malformado não derruba a fatia inteira.
      continue;
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// RM — Marcas
// ---------------------------------------------------------------------------

function parseRmChunk(chunkXml: string): ParsedRealEntry | null {
  const doc = parser.parse(chunkXml) as any;
  const processo = doc?.processo;
  if (!processo) return null;

  const processNumber = String(processo["@_numero"] ?? "").trim();
  if (!processNumber) return null;

  const titulares = asArray<any>(processo.titulares?.titular);
  const holder = titulares[0];
  const holderName = String(holder?.["@_nome-razao-social"] ?? "").trim() || undefined;
  const holderCountry = String(holder?.["@_pais"] ?? "").trim() || undefined;

  const brandName = textOf(processo.marca?.nome) || undefined;
  const presentation = String(processo.marca?.["@_apresentacao"] ?? "").trim() || undefined;
  const nature = String(processo.marca?.["@_natureza"] ?? "").trim() || undefined;

  const niceClasses = asArray<any>(processo["lista-classe-nice"]?.["classe-nice"]).map((c) => ({
    niceClass: String(c?.["@_codigo"] ?? "").trim(),
    specification: textOf(c?.especificacao) || undefined,
  }));

  const dispatches: RealDispatchRecord[] = [];
  for (const d of asArray<any>(processo.despachos?.despacho)) {
    const code = String(d?.["@_codigo"] ?? "").trim() || undefined;
    const name = String(d?.["@_nome"] ?? "").trim();
    const pieces: string[] = [];
    if (name) pieces.push(name);
    const complement = asArray<any>(d?.["texto-complementar"]).map(textOf).filter(Boolean);
    pieces.push(...complement);
    for (const protocolo of asArray<any>(d?.protocolo)) {
      const requerente = asArray<any>(protocolo?.requerente)
        .map((r) => String(r?.["@_nome-razao-social"] ?? "").trim())
        .filter(Boolean);
      if (requerente.length) pieces.push(`Requerente: ${requerente.join("; ")}`);
    }
    const rawText = textOf(d);
    if (rawText) pieces.push(rawText);
    if (!pieces.length) continue;
    dispatches.push({
      processNumber,
      dispatchCode: code,
      dispatchText: pieces.join(" — "),
      holderName,
      title: brandName,
      entityKind: "TRADEMARK",
    });
  }

  const trademark: TrademarkSnapshot = {
    processNumber,
    brandName,
    presentation,
    nature,
    holderName,
    holderCountry,
    // O nome do despacho publicado é o estado mais recente conhecido do processo.
    status: String(asArray<any>(processo.despachos?.despacho)[0]?.["@_nome"] ?? "").trim() || undefined,
    applicationDate: String(processo["@_data-deposito"] ?? "").trim() || undefined,
    registrationDate: String(processo["@_data-concessao"] ?? "").trim() || undefined,
    expirationDate: String(processo["@_data-vigencia"] ?? "").trim() || undefined,
    attorney: textOf(processo.procurador) || undefined,
    niceClasses: niceClasses.filter((c) => c.niceClass),
    applicants: titulares
      .map((t) => ({
        name: String(t?.["@_nome-razao-social"] ?? "").trim(),
        country: String(t?.["@_pais"] ?? "").trim() || undefined,
      }))
      .filter((a) => a.name),
  };

  return { dispatches, trademark };
}

// ---------------------------------------------------------------------------
// P / PC — Patentes e Programa de computador
// ---------------------------------------------------------------------------

function parseDespachoChunk(chunkXml: string, kind: "P" | "PC"): ParsedRealEntry | null {
  const doc = parser.parse(chunkXml) as any;
  const despacho = doc?.despacho;
  if (!despacho) return null;

  const proc = kind === "P" ? despacho["processo-patente"] : despacho["processo-programa"];
  const processNumber = textOf(proc?.numero);
  if (!processNumber) return null;

  const dispatchCode = textOf(despacho.codigo) || undefined;
  const dispatchTitle = textOf(despacho.titulo);
  const comment = textOf(despacho.comentario);
  const inventionTitle = textOf(proc?.titulo) || undefined;

  let applicants: Array<{ name: string; country?: string }> = [];
  if (kind === "P") {
    applicants = asArray<any>(proc?.["titular-lista"]?.titular)
      .map((t) => ({
        name: textOf(t?.["nome-completo"]),
        country: textOf(t?.endereco?.pais?.sigla) || undefined,
      }))
      .filter((a) => a.name);
  } else {
    applicants = asArray<any>(proc?.titularLista?.titular)
      .map((t) => ({ name: textOf(t?.nome) }))
      .filter((a) => a.name);
  }
  const holderName = applicants[0]?.name;

  const dispatchText = [dispatchTitle, comment].filter(Boolean).join(" — ") || dispatchTitle;
  if (!dispatchText) return null;

  const dispatch: RealDispatchRecord = {
    processNumber,
    dispatchCode,
    dispatchText,
    holderName,
    title: inventionTitle,
    entityKind: kind === "P" ? "PATENT" : "SOFTWARE",
  };

  if (kind === "PC") {
    // Sem tabela global de software no MVP — apenas o despacho para monitoramento.
    return { dispatches: [dispatch] };
  }

  const patent: PatentSnapshot = {
    processNumber,
    title: inventionTitle,
    applicationDate: textOf(proc?.["data-deposito"]) || undefined,
    status: dispatchTitle || undefined,
    ipcCodes: asArray<any>(
      proc?.["classificacao-internacional-lista"]?.["classificacao-internacional"]
    )
      .map(textOf)
      .filter(Boolean),
    applicants,
    inventors: asArray<any>(proc?.["inventor-lista"]?.inventor)
      .map((i) => textOf(i?.["nome-completo"]))
      .filter(Boolean),
  };

  return { dispatches: [dispatch], patent };
}
