/**
 * Parser do HTML do pePI (busca.inpi.gov.br).
 *
 * O pePI não tem API: as páginas são JSP/tabelas dos anos 2000, estáveis
 * há muitos anos. O parsing é feito por extração direcionada (linhas de
 * resultado, células, rótulos), sem dependência de parser de DOM.
 * Se o INPI mudar o layout, os parsers retornam vazio — nunca lixo.
 */

export interface PepiTrademarkRow {
  codPedido: string;
  processNumber: string;
  priorityDate: string | null;
  presentation: string | null;
  brandName: string;
  status: string | null;
  holderName: string | null;
  classText: string | null;
}

export interface PepiPatentRow {
  codPedido: string;
  processNumber: string;
  depositDate: string | null;
  title: string;
  ipcText: string | null;
}

export interface PepiHolderMatch {
  pos: number;
  name: string;
}

export interface PepiDispatchRow {
  rpiNumber: string | null;
  rpiDate: string | null;
  dispatchCode: string | null;
  /** Descrição oficial do código (tooltip da página). */
  dispatchDescription: string | null;
  /** Complemento do despacho publicado na RPI. */
  complement: string | null;
}

export interface PepiTrademarkDetail {
  processNumber: string;
  brandName: string | null;
  status: string | null;
  presentation: string | null;
  nature: string | null;
  holders: string[];
  attorney: string | null;
  depositDate: string | null;
  grantDate: string | null;
  expirationDate: string | null;
  classes: Array<{ code: string; status: string | null; specification: string | null }>;
  dispatches: PepiDispatchRow[];
}

export interface PepiPatentDetail {
  processNumber: string;
  title: string | null;
  abstractText: string | null;
  depositDate: string | null;
  publicationDate: string | null;
  grantDate: string | null;
  ipcClasses: string[];
  applicants: string[];
  inventors: string[];
  attorney: string | null;
  dispatches: PepiDispatchRow[];
}

export interface PepiResultMeta {
  totalCount: number | null;
  page: number | null;
  pageCount: number | null;
  noResults: boolean;
}

// ---------------------------------------------------------------------------
// Helpers de texto
// ---------------------------------------------------------------------------

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

/** Texto visível de um fragmento (remove tags, scripts e popups ocultos). */
function textOf(fragment: string): string {
  return decodeEntities(
    fragment
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(HIDDEN_POPUP_RE, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Popups ocultos (VISIBILITY: hidden) contêm tabelas aninhadas que
 * quebram o fatiamento de células. Como não há <div> aninhado dentro
 * deles, o primeiro </div> fecha o popup.
 */
const HIDDEN_POPUP_RE = /<div\b[^>]*VISIBILITY:\s*hidden[^>]*>[\s\S]*?<\/div>/gi;
const DESC_OPEN = "@@DESCRICAO@@";
const DESC_CLOSE = "@@FIM_DESCRICAO@@";

function stripHiddenPopups(html: string): string {
  return html.replace(HIDDEN_POPUP_RE, " ");
}

/**
 * Remove os popups mas preserva a descrição do despacho (que só existe
 * dentro do popup) como marcador na própria célula — assim ela acompanha
 * a linha certa mesmo que alguma linha seja pulada.
 */
function stripPopupsKeepingDispatchDescription(html: string): string {
  return html.replace(HIDDEN_POPUP_RE, (popup) => {
    // Não usar textOf aqui: ele removeria o próprio popup. Só tiramos tags.
    const text = decodeEntities(popup.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const desc = /Descri[çc][ãa]o Despacho\s*(.*)$/i.exec(text);
    const value = (desc ? desc[1] : "").replace(/^\s*[\d.]+\s+/, "").trim();
    return value ? ` ${DESC_OPEN}${value}${DESC_CLOSE} ` : " ";
  });
}

/** Células (<td>) de uma linha, com o HTML interno bruto. */
function cellsOf(rowHtml: string): string[] {
  return rowHtml
    .split(/<td\b/i)
    .slice(1)
    .map((chunk) => {
      const close = chunk.search(/<\/td>/i);
      const inner = close >= 0 ? chunk.slice(0, close) : chunk;
      return inner.slice(inner.indexOf(">") + 1);
    });
}

function firstLinkText(fragment: string): string | null {
  const m = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(fragment);
  return m ? textOf(m[1]) || null : null;
}

function dateOrNull(value: string | null | undefined): string | null {
  const m = /(\d{2}\/\d{2}\/\d{4})/.exec(value ?? "");
  return m ? m[1] : null;
}

function emptyAsNull(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return t && t !== "-" ? t : null;
}

// ---------------------------------------------------------------------------
// Metadados do resultado
// ---------------------------------------------------------------------------

export function parseResultMeta(html: string): PepiResultMeta {
  const count = /Foram encontrados\s*<b>(\d+)<\/b>/i.exec(html);
  const pages = /Mostrando p[aá]gina\s*<b>(\d+)<\/b>\s*de\s*<b>(\d+)<\/b>/i.exec(html);
  return {
    totalCount: count ? Number(count[1]) : null,
    page: pages ? Number(pages[1]) : null,
    pageCount: pages ? Number(pages[2]) : null,
    noResults: /Nenhum resultado foi encontrado/i.test(html),
  };
}

// ---------------------------------------------------------------------------
// Listas de resultado
// ---------------------------------------------------------------------------

const TM_DETAIL_LINK = /MarcasServletController\?Action=detail&(?:amp;)?CodPedido=(\d+)/i;
const PT_DETAIL_LINK = /PatenteServletController\?Action=detail&(?:amp;)?CodPedido=(\d+)/i;

/**
 * Linhas da tabela de marcas. Colunas fixas do pePI:
 * processo(link) | prioridade | apresentação(img) | marca | situação(img) |
 * situação(texto) | titular | classe.
 */
export function parseTrademarkRows(html: string): PepiTrademarkRow[] {
  const rows: PepiTrademarkRow[] = [];
  for (const chunk of html.split(/<tr\b/i).slice(1)) {
    const link = TM_DETAIL_LINK.exec(chunk);
    if (!link) continue;
    const cells = cellsOf(chunk);
    if (cells.length < 6) continue;
    const presentation = /alt="Marca ([^"]+)"/i.exec(cells[2] ?? "");
    rows.push({
      codPedido: link[1],
      processNumber: textOf(cells[0]).replace(/\s+/g, " "),
      priorityDate: dateOrNull(textOf(cells[1] ?? "")),
      presentation: presentation ? presentation[1] : null,
      brandName: emptyAsNull(textOf(cells[3] ?? "")) ?? "",
      status: emptyAsNull(textOf(cells[5] ?? "")),
      holderName: emptyAsNull(textOf(cells[6] ?? "")),
      classText: emptyAsNull(textOf(cells[7] ?? "")),
    });
  }
  return rows;
}

/** Linhas da tabela de patentes: pedido(link) | depósito | título | IPC. */
export function parsePatentRows(html: string): PepiPatentRow[] {
  const rows: PepiPatentRow[] = [];
  for (const chunk of html.split(/<tr\b/i).slice(1)) {
    const link = PT_DETAIL_LINK.exec(chunk);
    if (!link) continue;
    const cells = cellsOf(chunk);
    if (cells.length < 3) continue;
    rows.push({
      codPedido: link[1],
      processNumber: textOf(cells[0]),
      depositDate: dateOrNull(textOf(cells[1] ?? "")),
      title: textOf(cells[2] ?? ""),
      ipcText: emptyAsNull(textOf(cells[3] ?? "")),
    });
  }
  return rows;
}

/** Primeiro passo da busca por titular: lista de titulares com link `pos=N`. */
export function parseHolderMatches(html: string): PepiHolderMatch[] {
  const matches: PepiHolderMatch[] = [];
  const re =
    /MarcasServletController\?Action=searchMarca&(?:amp;)?tipoPesquisa=BY_CNPJ_NOME&(?:amp;)?pos=(\d+)[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const name = textOf(m[2]);
    if (name) matches.push({ pos: Number(m[1]), name });
  }
  return matches;
}

export function extractClassCodes(classText: string | null): string[] {
  if (!classText) return [];
  const ncl = /NCL\(\d+\)\s*(\d{1,2})/.exec(classText);
  if (ncl) return [ncl[1].padStart(2, "0")];
  const national = /^(\d{1,2})\s*:/.exec(classText.trim());
  if (national) return [national[1].padStart(2, "0")];
  return [];
}

// ---------------------------------------------------------------------------
// Despachos (tabela de publicações na RPI, comum a marcas e patentes)
// ---------------------------------------------------------------------------

function parseDispatchRows(html: string): PepiDispatchRow[] {
  // A tabela de publicações é a que tem a coluna "Complemento do Despacho".
  const header = /Complemento do Despacho/i.exec(html);
  if (!header) return [];
  const afterHeader = html.slice(header.index);
  const tbodyAt = afterHeader.search(/<tbody\b/i);
  if (tbodyAt < 0) return [];
  // Remover os popups (e suas tabelas aninhadas) ANTES de achar o fim da
  // tabela — senão o </table> do popup corta a seção na primeira linha.
  const body = stripPopupsKeepingDispatchDescription(afterHeader.slice(tbodyAt));
  const tableEnd = body.search(/<\/table>/i);
  const section = tableEnd >= 0 ? body.slice(0, tableEnd) : body;

  const rows: PepiDispatchRow[] = [];
  for (const chunk of section.split(/<tr\b/i).slice(1)) {
    const cells = cellsOf(chunk);
    if (cells.length < 3) continue;
    const rpiNumber = emptyAsNull(textOf(cells[0]));
    if (!rpiNumber || !/^\d+$/.test(rpiNumber)) continue;
    const codeCell = cells[2] ?? "";
    const descMatch = new RegExp(`${DESC_OPEN}([\\s\\S]*?)${DESC_CLOSE}`).exec(codeCell);
    const codeText = emptyAsNull(
      textOf(codeCell.replace(new RegExp(`${DESC_OPEN}[\\s\\S]*?${DESC_CLOSE}`), " "))
    );
    rows.push({
      rpiNumber,
      rpiDate: dateOrNull(textOf(cells[1] ?? "")),
      dispatchCode: codeText,
      dispatchDescription: descMatch ? descMatch[1].trim() : null,
      complement: emptyAsNull(textOf(cells[cells.length - 1] ?? "")),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Detalhe de marca
// ---------------------------------------------------------------------------

/** Valor da linha "Rótulo: | valor" das tabelas de detalhe. */
function labeledValue(html: string, label: string): string | null {
  const re = new RegExp(`${label}:?\\s*</font>\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`, "i");
  const m = re.exec(html);
  return m ? emptyAsNull(textOf(m[1])) : null;
}

export function parseTrademarkDetail(html: string): PepiTrademarkDetail | null {
  const processNumber =
    /id="numeroProcesso"[^>]*value\s*=\s*"(\d+)"/i.exec(html)?.[1] ??
    labeledValue(html, "N[ºo] do Processo");
  if (!processNumber) return null;

  // Datas: única tabela com cabeçalho "Data de Depósito"; valores em <th>.
  let depositDate: string | null = null;
  let grantDate: string | null = null;
  let expirationDate: string | null = null;
  const datesAt = html.search(/Data de Dep[óo]sito/i);
  if (datesAt >= 0) {
    const tbody = /<tbody>([\s\S]*?)<\/tbody>/i.exec(html.slice(datesAt));
    if (tbody) {
      const values = [...tbody[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
        dateOrNull(textOf(m[1]))
      );
      [depositDate = null, grantDate = null, expirationDate = null] = values;
    }
  }

  const holders = [
    ...html.matchAll(/Titular\(\d+\):<\/font>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi),
  ]
    .map((m) => textOf(m[1]))
    .filter(Boolean);

  const attorneyMatch = /Procurador:<\/font>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i.exec(html);

  const classes: PepiTrademarkDetail["classes"] = [];
  const classesAt = html.search(/Classifica[çc][ãa]o de Produtos/i);
  if (classesAt >= 0) {
    const titularesAt = html.search(/Titulares/i);
    const section = stripHiddenPopups(
      html.slice(classesAt, titularesAt > classesAt ? titularesAt : undefined)
    );
    for (const chunk of section.split(/<tr\b/i).slice(1)) {
      const cells = cellsOf(chunk);
      if (cells.length < 3) continue;
      const code = firstLinkText(cells[0]) ?? textOf(cells[0]);
      if (!code || !/\d/.test(code)) continue;
      classes.push({
        code: code.replace(/\s+/g, " ").trim(),
        status: emptyAsNull(textOf(cells[1])),
        specification: emptyAsNull(textOf(cells[2])),
      });
    }
  }

  return {
    processNumber,
    brandName: labeledValue(html, "Marca"),
    status: labeledValue(html, "Situa[çc][ãa]o"),
    presentation: labeledValue(html, "Apresenta[çc][ãa]o"),
    nature: labeledValue(html, "Natureza"),
    holders,
    attorney: attorneyMatch ? emptyAsNull(textOf(attorneyMatch[1])) : null,
    depositDate,
    grantDate,
    expirationDate,
    classes,
    dispatches: parseDispatchRows(html),
  };
}

// ---------------------------------------------------------------------------
// Detalhe de patente (campos INID)
// ---------------------------------------------------------------------------

/** Captura o valor entre um marcador INID e o próximo marcador/fim. */
function inidValue(text: string, code: string, label: string): string | null {
  const re = new RegExp(
    `\\(${code}\\)\\s*${label}:?\\s*(.*?)\\s*(?=\\(\\d{2}\\)|Anuidades|Publica[çc][õo]es|$)`,
    "i"
  );
  const m = re.exec(text);
  return m ? emptyAsNull(m[1]) : null;
}

function splitNames(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\s*\/\s*/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parsePatentDetail(html: string): PepiPatentDetail | null {
  const text = textOf(html);
  const processNumber = inidValue(text, "21", "N[ºo] do Pedido");
  if (!processNumber) return null;

  const ipcRaw = inidValue(text, "51", "Classifica[çc][ãa]o IPC") ?? "";
  const ipcClasses = [...ipcRaw.matchAll(/[A-H]\d{2}[A-Z]\s*\d+\/\d+|[A-H]\d{2}[A-Z]/g)].map((m) =>
    m[0].replace(/\s+/g, " ").trim()
  );

  return {
    // O (21) vem com o código de publicação no fim ("BR 10 2025 019821 5 A2").
    processNumber: processNumber.replace(/\s+[A-Z]\d?$/, ""),
    title: inidValue(text, "54", "T[íi]tulo"),
    abstractText: inidValue(text, "57", "Resumo"),
    depositDate: dateOrNull(inidValue(text, "22", "Data do Dep[óo]sito")),
    publicationDate: dateOrNull(inidValue(text, "43", "Data da Publica[çc][ãa]o")),
    grantDate: dateOrNull(inidValue(text, "47", "Data da Concess[ãa]o")),
    ipcClasses: [...new Set(ipcClasses)],
    applicants: splitNames(inidValue(text, "71", "Nome do Depositante")),
    inventors: splitNames(inidValue(text, "72", "Nome do Inventor")),
    attorney: inidValue(text, "74", "Nome do Procurador"),
    dispatches: parseDispatchRows(html),
  };
}
