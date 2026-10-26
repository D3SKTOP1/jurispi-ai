/**
 * Cliente do portal de GRU/pagamento do INPI (meu.inpi.gov.br/pag).
 *
 * Diferente do pePI (busca pública anônima), este portal exige LOGIN
 * e-INPI (usuário/senha). A senha vem do cofre criptografado
 * (credential-vault) — este cliente só a recebe já decifrada, em memória,
 * no momento da chamada, e nunca a registra em log.
 *
 * gov.br NÃO é suportado aqui (captcha/2FA); apenas usuário/senha e-INPI.
 *
 * Fluxos autenticados mapeados ao vivo em 14/07/2026 (docs/gru-mapping.md):
 * o assistente de emissão é AJAX (JSON em ISO-8859-1) e a consulta é um
 * form POST com Post/Redirect/Get. O pagador ("cliente") é o titular da
 * conta e-INPI — o portal já o fixa na sessão após o login.
 */
import { randomBytes } from "crypto";

const GRU_BASE = process.env.INPI_GRU_BASE_URL ?? "https://meu.inpi.gov.br";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = Number(process.env.INPI_GRU_TIMEOUT_MS ?? 25_000);

export class GruUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "GruUnavailableError";
  }
}

/** Credenciais inválidas (login recusado pelo INPI). */
export class GruAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GruAuthError";
  }
}

/** O INPI recusou a operação (validação do assistente, GRU inexistente etc.). */
export class GruRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GruRejectedError";
  }
}

// ---------------------------------------------------------------------------
// Tipos do assistente de emissão
// ---------------------------------------------------------------------------

/** Diretoria do INPI ("Tipo de Serviço" na tela: Marcas=300, Patentes=200…). */
export interface GruServiceType {
  codigo: string;
  nome: string;
}

/** Serviço da tabela de retribuições dentro de uma diretoria. */
export interface GruServiceItem {
  codigo: string;
  nome: string;
}

/** Flags que dizem quais campos o serviço exige no formulário. */
export interface GruServiceConfig {
  temPeticionamento: boolean;
  temApresentacao: boolean;
  temNatureza: boolean;
  temGuiaAnterior: boolean;
  temValor: boolean;
  temObjetoPeticao: boolean;
  temProcesso: boolean;
  temSolicitacao: boolean;
  /** Rótulo do campo "Total de X" quando temSolicitacao (ex.: "classes"). */
  tituloSolicitacao?: string;
  temRevista: boolean;
  temPeticaoVinculada: boolean;
}

export interface GruOption {
  value: string;
  label: string;
}

/** Opções dos selects condicionais do serviço escolhido. */
export interface GruServiceOptions {
  naturezas: GruOption[];
  apresentacoes: GruOption[];
  objetosPeticao: GruOption[];
  peticionamentos: GruOption[];
}

export interface GruEmissionParams {
  /** Código do serviço na tabela de retribuições do INPI (ex.: 389, 800). */
  serviceCode: string;
  /** Diretoria/tipo de serviço (ex.: 300 = Marcas). */
  diretoria: string;
  processNumber?: string;
  /** Total de classes/solicitações quando o serviço exige (temSolicitacao). */
  totalDe?: string;
  natureza?: string;
  apresentacao?: string;
  peticionamento?: string;
  objetoPeticao?: string;
  revista?: string;
  peticaoVinculada?: string;
  /** Valor livre quando o serviço exige (temValor). Formato "1225,30". */
  valorMonetario?: string;
  guiaAnterior?: string;
  copiaOficial?: string;
}

export interface GruPreviewItem {
  codigoServico: string;
  nomeServico: string;
  amountCents: number;
  amountFormatted: string;
}

export interface GruPreviewResult {
  items: GruPreviewItem[];
  totalCents: number;
  /** Mensagens informativas do INPI que não impedem a emissão. */
  warnings: string[];
}

export interface GruEmissionResult {
  gruNumber: string;
  amountCents?: number;
  dueDate?: string;
  /** Linha digitável/código de barras do boleto, quando o INPI devolve. */
  barcode?: string;
}

export interface GruStatusResult {
  gruNumber: string;
  /** Situação normalizada: PENDING | PAID | EXPIRED | CANCELLED | UNKNOWN. */
  status: string;
  /** Texto original da situação no portal (ex.: "Aguardando pagamento"). */
  statusText: string;
  serviceCode?: string;
  serviceLabel?: string;
  amountCents?: number;
  /** Data de cadastro no portal (dd/MM/yyyy). */
  issuedAtText?: string;
  paidAt?: string;
}

// ---------------------------------------------------------------------------
// Sessão autenticada
// ---------------------------------------------------------------------------

/** tab-id no mesmo formato do portal ("tab-" + sufixo curto). É só id de sessão de UI. */
function makeTabId(): string {
  return `tab-${randomBytes(6).toString("hex").slice(0, 9)}`;
}

/**
 * Decodifica respeitando o charset do Content-Type. O portal mistura:
 * páginas HTML em UTF-8 e os JSON do assistente em ISO-8859-1.
 */
function decodeBody(buffer: ArrayBuffer, contentType: string | null): string {
  const charset = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1]?.toLowerCase();
  try {
    return new TextDecoder(charset ?? "utf-8").decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

export class GruSession {
  private cookies = new Map<string, string>();
  private readonly tabId = makeTabId();
  authenticated = false;

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private storeCookies(res: Response) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  private async fetchRaw(pathname: string, init?: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${GRU_BASE}${pathname}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        ...init,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          ...(this.cookies.size > 0 ? { Cookie: this.cookieHeader() } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch (error) {
      throw new GruUnavailableError(`Portal GRU inacessível (${pathname}).`, error);
    }
    this.storeCookies(res);
    return res;
  }

  async request(pathname: string, init?: RequestInit): Promise<{ status: number; html: string; location?: string }> {
    const res = await this.fetchRaw(pathname, init);
    const buffer = await res.arrayBuffer();
    return {
      status: res.status,
      html: decodeBody(buffer, res.headers.get("content-type")),
      location: res.headers.get("location") ?? undefined,
    };
  }

  /** GET/POST AJAX do assistente (JSON). Lança GruUnavailableError se não vier JSON. */
  async requestJson<T>(pathname: string, body?: Record<string, string>): Promise<T> {
    const res = await this.request(pathname, {
      method: body ? "POST" : "GET",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${GRU_BASE}/pag/gru/gerar`,
        Origin: GRU_BASE,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
      },
      body: body ? new URLSearchParams(body).toString() : undefined,
    });
    try {
      return JSON.parse(res.html) as T;
    } catch {
      throw new GruUnavailableError(
        `Resposta inesperada do portal GRU em ${pathname} (status ${res.status}). A sessão pode ter expirado.`
      );
    }
  }

  /** Baixa um arquivo binário (boleto PDF). */
  async requestBinary(pathname: string, referer: string): Promise<{ buffer: Buffer; contentType: string | null }> {
    const res = await this.fetchRaw(pathname, { headers: { Accept: "*/*", Referer: `${GRU_BASE}${referer}` } });
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType: res.headers.get("content-type") };
  }

  /** Segue redirects manualmente e devolve a página final. */
  async follow(start: { status: number; html: string; location?: string }) {
    let res = start;
    for (let hop = 0; hop < 5 && res.status >= 300 && res.status < 400 && res.location; hop += 1) {
      res = await this.request(pathOf(res.location));
    }
    return res;
  }

  /**
   * Login e-INPI. Recebe login/senha já decifrados (do cofre). Retorna a
   * sessão autenticada; lança GruAuthError se o INPI recusar as credenciais.
   */
  async login(login: string, senha: string): Promise<void> {
    // 1. Abre a página de login para obter cookies de sessão (JSESSIONID).
    //    `/pag` responde 302 → `/pag/`; é no `/pag/` que vem o cookie.
    let page = await this.request("/pag/");
    if (page.status >= 300 && page.status < 400 && page.location) {
      page = await this.request(pathOf(page.location));
    }
    // O portal grava o tab-id também como cookie.
    this.cookies.set("sessionStorageValue", this.tabId);

    // 2. Autentica.
    const body = new URLSearchParams({
      "usuario.tab_id": this.tabId,
      "usuario.browser": "chrome/126.0.0.0",
      "usuario.login": login,
      "usuario.senha": senha,
    }).toString();

    const res = await this.follow(
      await this.request("/pag/autenticar", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: GRU_BASE, Referer: `${GRU_BASE}/pag/` },
        body,
      })
    );

    // Tanto sucesso quanto falha respondem 302. A diferença é o destino:
    // falha volta para a página de login (/pag/); sucesso vai para a área
    // autenticada (/pag/gru/gerar). Checamos a página final.
    const isLoginPage = /name="usuario\.senha"|id="loginForm"|Formul[aá]rio de login/i.test(res.html);
    if (isLoginPage) {
      throw new GruAuthError("Login e-INPI recusado: verifique usuário e senha.");
    }
    this.authenticated = true;
  }
}

/** Extrai o caminho (+query) de uma URL absoluta ou relativa, ignorando o esquema. */
function pathOf(location: string): string {
  try {
    const url = new URL(location, GRU_BASE);
    return `${url.pathname}${url.search}`;
  } catch {
    return location.startsWith("/") ? location : `/${location}`;
  }
}

// ---------------------------------------------------------------------------
// Parsers puros (exportados para teste)
// ---------------------------------------------------------------------------

/** Mensagens de erro do INPI vêm com "???chave???" nas pontas — limpa e junta. */
export function cleanInpiMessages(items: Array<{ message?: string; category?: string }>): string {
  return items
    .map((i) => (i.message ?? "").replace(/\?\?\?/g, "").trim())
    .filter(Boolean)
    .join(" ");
}

/** "R$ 440.00" | "440,00" | "1.234,56" → centavos. */
export function parseMoneyToCents(text: string): number | undefined {
  const raw = text.replace(/R\$/i, "").replace(/\s/g, "");
  if (!raw) return undefined;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const sep = Math.max(lastComma, lastDot);
  // Separador decimal = o último "." ou "," quando seguido de 1–2 dígitos.
  let intPart = raw;
  let decPart = "0";
  if (sep >= 0 && raw.length - sep - 1 <= 2) {
    intPart = raw.slice(0, sep);
    decPart = raw.slice(sep + 1).padEnd(2, "0");
  }
  const cents = Number(intPart.replace(/\D/g, "")) * 100 + Number(decPart.replace(/\D/g, "").slice(0, 2) || "0");
  return Number.isFinite(cents) ? cents : undefined;
}

/** Situação do portal → status normalizado. */
export function mapGruStatus(statusText: string): string {
  const t = statusText.toLowerCase();
  if (/aguardando/.test(t)) return "PENDING";
  if (/pag[oa]|confirmad|quitad/.test(t)) return "PAID";
  if (/vencid|expirad/.test(t)) return "EXPIRED";
  if (/cancelad|estornad/.test(t)) return "CANCELLED";
  return "UNKNOWN";
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tabela "Resultado" de /pag/minhasgrus/. Colunas:
 * GRU | Serviço ("389 - Nome…") | Valor ("R$ 440.00") | Situação | 2ª via | Recibo | Data Cadastro.
 */
export function parseMinhasGrusHtml(html: string): GruStatusResult[] {
  const resultSection = html.split(/<legend[^>]*>\s*Resultado\s*<\/legend>/i)[1];
  if (!resultSection) return [];
  const tbody = /<tbody>([\s\S]*?)<\/tbody>/i.exec(resultSection)?.[1];
  if (!tbody) return [];

  const rows: GruStatusResult[] = [];
  for (const rowMatch of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));
    if (cells.length < 4) continue;
    const gruNumber = cells[0].replace(/\D/g, "");
    if (!gruNumber) continue;
    const serviceMatch = /^(\d+)\s*-\s*(.+)$/.exec(cells[1]);
    const statusText = cells[3];
    rows.push({
      gruNumber,
      status: mapGruStatus(statusText),
      statusText,
      serviceCode: serviceMatch?.[1],
      serviceLabel: serviceMatch ? serviceMatch[2].trim() : cells[1] || undefined,
      amountCents: parseMoneyToCents(cells[2]),
      issuedAtText: cells[6],
    });
  }
  return rows;
}

/** Tela /pag/gru/finalizada → número da GRU e código interno do boleto. */
export function parseFinalizadaHtml(html: string): { gruNumber?: string; boletoCode?: string } {
  return {
    gruNumber: /id="nosso-numero"[^>]*>\s*(\d+)/.exec(html)?.[1],
    boletoCode: /\/gru\/imprimir\/codigo\/(\d+)/.exec(html)?.[1],
  };
}

// ---------------------------------------------------------------------------
// Assistente de emissão (autenticado)
// ---------------------------------------------------------------------------

type InpiMessage = { message?: string; category?: string };

function isMessageArray(json: unknown): json is InpiMessage[] {
  return (
    Array.isArray(json) &&
    json.length > 0 &&
    typeof json[0] === "object" &&
    json[0] !== null &&
    "message" in json[0] &&
    "category" in json[0]
  );
}

/** Diretorias ("Tipo de Serviço"): Marcas=300, Patentes=200, DI=100, Software=700… */
export async function fetchServiceTypes(session: GruSession): Promise<GruServiceType[]> {
  const json = await session.requestJson<Array<{ codigo: number | string; nome: string }>>(
    "/pag/gru/buscar/tipoServico"
  );
  return json.map((t) => ({ codigo: String(t.codigo), nome: t.nome.trim() }));
}

/** Serviços da tabela de retribuições de uma diretoria. */
export async function fetchServices(session: GruSession, diretoria: string): Promise<GruServiceItem[]> {
  const json = await session.requestJson<Array<{ codigo: number | string; nomeServico: string }> | InpiMessage[]>(
    `/pag/gru/buscar/servico/diretoria/${encodeURIComponent(diretoria)}`
  );
  if (isMessageArray(json)) throw new GruRejectedError(cleanInpiMessages(json));
  return (json as Array<{ codigo: number | string; nomeServico: string }>).map((s) => ({
    codigo: String(s.codigo),
    nome: s.nomeServico.trim(),
  }));
}

/** Flags de campos exigidos pelo serviço. */
export async function fetchServiceConfig(
  session: GruSession,
  serviceCode: string,
  diretoria: string
): Promise<GruServiceConfig> {
  const json = await session.requestJson<GruServiceConfig | InpiMessage[]>(
    `/pag/gru/pesquisar/servico/${encodeURIComponent(serviceCode)}/diretoria/${encodeURIComponent(diretoria)}`
  );
  if (isMessageArray(json)) throw new GruRejectedError(cleanInpiMessages(json));
  return json as GruServiceConfig;
}

/** Opções dos selects condicionais (só busca as que o serviço exige). */
export async function fetchServiceOptions(
  session: GruSession,
  config: GruServiceConfig,
  serviceCode: string,
  diretoria: string
): Promise<GruServiceOptions> {
  const options: GruServiceOptions = {
    naturezas: [],
    apresentacoes: [],
    objetosPeticao: [],
    peticionamentos: config.temPeticionamento
      ? [
          { value: "0", label: "Papel" },
          { value: "1", label: "Eletrônico" },
        ]
      : [],
  };
  if (config.temNatureza) {
    const json = await session.requestJson<Array<{ natureza: number | string; descricao: string }>>(
      `/pag/gru/buscar/preencher/natureza/${encodeURIComponent(diretoria)}/${encodeURIComponent(serviceCode)}`
    );
    options.naturezas = json.map((n) => ({ value: String(n.natureza), label: n.descricao.trim() }));
  }
  if (config.temApresentacao) {
    const json = await session.requestJson<Array<{ codigo: number | string; descricao: string }>>(
      `/pag/gru/buscar/preencher/apresentacao/${encodeURIComponent(diretoria)}`
    );
    options.apresentacoes = json.map((a) => ({ value: String(a.codigo), label: a.descricao.trim() }));
  }
  if (config.temObjetoPeticao) {
    const json = await session.requestJson<Array<{ codigoTipoObjeto: number | string; descricaoObjeto: string }>>(
      `/pag/gru/buscar/preencher/objetoPeticao/${encodeURIComponent(serviceCode)}`
    );
    options.objetosPeticao = json.map((o) => ({ value: String(o.codigoTipoObjeto), label: o.descricaoObjeto.trim() }));
  }
  return options;
}

/** Campos do formulário do assistente, no formato que o portal espera. */
function buildEmissionFields(params: GruEmissionParams): Record<string, string> {
  return {
    "servico.diretoria": params.diretoria,
    "servico.codigoServico": params.serviceCode,
    "servico.peticionamento": params.peticionamento ?? "",
    "servico.guiaAnterior": params.guiaAnterior ?? "",
    "servico.valorMonetario": params.valorMonetario ?? "",
    "servico.objetoPeticao": params.objetoPeticao ?? "",
    "servico.processo": params.processNumber ?? "",
    "servico.revista": params.revista ?? "",
    "servico.totalDe": params.totalDe ?? "",
    "servico.totalDeNome": "",
    "servico.peticaoVinculada": params.peticaoVinculada ?? "",
    "servico.apresentacao": params.apresentacao ?? "",
    "servico.natureza": params.natureza ?? "",
    "servico.desconto": "",
    "servico.copiaOficial": params.copiaOficial ?? "",
  };
}

type PreviewServico = {
  codigoServico: string;
  nomeServico: string;
  valorTotal: string;
  valorTotalFormatado: string;
};

/**
 * Preview do valor (POST /pag/gru/mostrar/preview) — NÃO gera a GRU.
 * Lança GruRejectedError com a(s) mensagem(ns) do INPI se a combinação de
 * campos for recusada.
 */
export async function previewGru(session: GruSession, params: GruEmissionParams): Promise<GruPreviewResult> {
  const json = await session.requestJson<
    PreviewServico[] | { errors?: InpiMessage[]; servico?: PreviewServico[] } | InpiMessage[]
  >("/pag/gru/mostrar/preview", { "servico.principal": "true", ...buildEmissionFields(params) });

  let items: PreviewServico[] = [];
  const warnings: string[] = [];
  if (Array.isArray(json)) {
    if (isMessageArray(json)) throw new GruRejectedError(cleanInpiMessages(json));
    items = json as PreviewServico[];
  } else {
    const errors = json.errors ?? [];
    const hard = errors.filter((e) => e.category === "erro" || e.category === "error");
    if (!json.servico || hard.length > 0) {
      throw new GruRejectedError(cleanInpiMessages(hard.length > 0 ? hard : errors) || "Emissão recusada pelo INPI.");
    }
    warnings.push(...errors.map((e) => (e.message ?? "").replace(/\?\?\?/g, "").trim()).filter(Boolean));
    items = json.servico;
  }

  const mapped = items.map((i) => ({
    codigoServico: i.codigoServico,
    nomeServico: i.nomeServico.trim(),
    amountCents: parseMoneyToCents(i.valorTotalFormatado ?? i.valorTotal) ?? 0,
    amountFormatted: i.valorTotalFormatado,
  }));
  return {
    items: mapped,
    totalCents: mapped.reduce((sum, i) => sum + i.amountCents, 0),
    warnings,
  };
}

/**
 * Emite a GRU (POST /pag/gru/finalizar/gerarGru). ⚠️ Gera uma guia REAL no
 * INPI, com retribuição real. Faz o preview antes na mesma sessão (o valor
 * devolvido vem dele) e, após gerar, lê /pag/gru/finalizada para obter o
 * código de barras do boleto.
 */
export async function submitGruEmission(
  session: GruSession,
  params: GruEmissionParams
): Promise<GruEmissionResult> {
  const preview = await previewGru(session, params);

  const json = await session.requestJson<string | InpiMessage[]>("/pag/gru/finalizar/gerarGru", {
    ...buildEmissionFields(params),
    "servico.pagamentoDigital": "false",
  });
  if (isMessageArray(json)) throw new GruRejectedError(cleanInpiMessages(json));
  if (typeof json !== "string" || !/^\d{5,}$/.test(json)) {
    throw new GruUnavailableError("O INPI não devolveu o número da GRU gerada.");
  }
  const gruNumber = json;

  // Código de barras: a tela de finalização aponta /gru/imprimir/codigo/<id>
  // e /gru/copiar/codigo/<id>. Falha aqui não invalida a emissão.
  let barcode: string | undefined;
  try {
    const fin = await session.follow(
      await session.request("/pag/gru/finalizada", { headers: { Referer: `${GRU_BASE}/pag/gru/gerar` } })
    );
    const { boletoCode } = parseFinalizadaHtml(fin.html);
    if (boletoCode) {
      const raw = await session.requestJson<string>(`/pag/gru/copiar/codigo/${boletoCode}`);
      if (typeof raw === "string" && /^\d{20,}$/.test(raw)) barcode = raw;
    }
  } catch {
    // barcode é opcional; o boleto continua acessível pela 2ª via.
  }

  return { gruNumber, amountCents: preview.totalCents || undefined, barcode };
}

// ---------------------------------------------------------------------------
// Consulta (Minhas GRUs) e boleto
// ---------------------------------------------------------------------------

export type GruSearchQuery = { gruNumber: string } | { from: string; to: string };

/**
 * Pesquisa em /pag/minhasgrus/ (Post/Redirect/Get). Datas em dd/MM/yyyy.
 * O cliente/pagador já está fixado na sessão (titular da conta e-INPI).
 */
export async function searchGrus(session: GruSession, query: GruSearchQuery): Promise<GruStatusResult[]> {
  const byNumber = "gruNumber" in query;
  const body = new URLSearchParams({
    tipoPesquisa: byNumber ? "G" : "D",
    dataInicio: byNumber ? "" : query.from,
    dataFim: byNumber ? "" : query.to,
    numeroGru: byNumber ? query.gruNumber.replace(/\D/g, "") : "",
  }).toString();

  const res = await session.follow(
    await session.request("/pag/minhasgrus/pesquisa", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: GRU_BASE,
        Referer: `${GRU_BASE}/pag/minhasgrus/`,
      },
      body,
    })
  );
  return parseMinhasGrusHtml(res.html);
}

/** Consulta a situação de uma GRU pelo número. */
export async function fetchGruStatus(session: GruSession, gruNumber: string): Promise<GruStatusResult> {
  const rows = await searchGrus(session, { gruNumber });
  const row = rows.find((r) => r.gruNumber === gruNumber.replace(/\D/g, "")) ?? rows[0];
  if (!row) {
    throw new GruRejectedError(`GRU ${gruNumber} não encontrada na conta e-INPI conectada.`);
  }
  return row;
}

/** Baixa o PDF do boleto (2ª via) pelo número da GRU. */
export async function downloadBoletoPdf(session: GruSession, gruNumber: string): Promise<Buffer> {
  const { buffer } = await session.requestBinary(
    `/pag/minhasgrus/segundaviaboleto?codGru=${encodeURIComponent(gruNumber.replace(/\D/g, ""))}`,
    "/pag/minhasgrus/"
  );
  if (buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw new GruRejectedError(`O INPI não devolveu o boleto da GRU ${gruNumber}. Confira o número.`);
  }
  return buffer;
}

/** Deriva {login, senha} do cofre e executa uma operação autenticada. */
export async function withGruSession<T>(
  credentials: { login: string; senha: string },
  op: (session: GruSession) => Promise<T>
): Promise<T> {
  const session = new GruSession();
  await session.login(credentials.login, credentials.senha);
  return op(session);
}
