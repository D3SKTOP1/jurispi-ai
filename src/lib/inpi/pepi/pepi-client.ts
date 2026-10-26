/**
 * Cliente HTTP do pePI (busca.inpi.gov.br) — a base de consulta pública
 * do INPI. Não existe API oficial: o acesso é o mesmo do navegador,
 * via sessão anônima (sem login, sem captcha) e formulários POST.
 *
 * Regras de convivência com o serviço público:
 * - somente consultas pontuais disparadas por usuário (nunca crawling em massa);
 * - uma sessão nova por operação (a sessão anônima expira em minutos);
 * - timeout curto e no máximo 1 retry — indisponibilidade vira fallback
 *   para a base local, nunca loop de tentativas.
 */

const PEPI_BASE = process.env.INPI_PEPI_BASE_URL ?? "https://busca.inpi.gov.br";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Timeouts por perfil de operação. A busca de MARCAS e as consultas por
 * número/detalhe são rápidas (<3s). A busca textual de PATENTES é pesada
 * no servidor do INPI (chega a 20-50s) — daí um teto próprio e alto.
 * Em ambiente serverless, o limite da função pode ser menor; nesse caso
 * a operação falha e o chamador cai no fallback da base local.
 */
const DEFAULT_TIMEOUT_MS = Number(process.env.INPI_PEPI_TIMEOUT_MS ?? 20_000);
export const PEPI_SLOW_TIMEOUT_MS = Number(process.env.INPI_PEPI_SLOW_TIMEOUT_MS ?? 55_000);

export class PepiUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "PepiUnavailableError";
  }
}

/** Sessão anônima do pePI: cookie jar mínimo (JSESSIONID + balanceador). */
export class PepiSession {
  private cookies = new Map<string, string>();

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

  /** GET/POST com decodificação windows-1252 (encoding do pePI). */
  async request(
    pathname: string,
    init?: RequestInit,
    opts?: { timeoutMs?: number }
  ): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${PEPI_BASE}${pathname}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        ...init,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          ...(this.cookies.size > 0 ? { Cookie: this.cookieHeader() } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch (error) {
      throw new PepiUnavailableError(`pePI inacessível (${pathname}).`, error);
    }
    this.storeCookies(res);
    if (res.status >= 400) {
      throw new PepiUnavailableError(`pePI respondeu HTTP ${res.status} em ${pathname}.`);
    }
    const buffer = await res.arrayBuffer();
    return new TextDecoder("windows-1252").decode(buffer);
  }

  async postForm(
    pathname: string,
    fields: Record<string, string>,
    opts?: { timeoutMs?: number }
  ): Promise<string> {
    const body = Object.entries(fields)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
      .join("&");
    return this.request(
      pathname,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
      opts
    );
  }

  /** Login anônimo ("Continuar..." da tela inicial). */
  async login(): Promise<void> {
    const html = await this.request("/pePI/servlet/LoginController?action=login");
    if (/name="T_Login"/i.test(html)) {
      throw new PepiUnavailableError("pePI não aceitou a sessão anônima.");
    }
  }
}

/** O pePI devolve a tela de login quando a sessão expira. */
function isLoginPage(html: string): boolean {
  return /name="T_Login"/i.test(html) || /Formul[aá]rio de login/i.test(html);
}

/**
 * Executa uma operação com sessão anônima nova. Se a sessão cair no meio
 * (tela de login no lugar do resultado), tenta mais uma vez do zero.
 */
export async function withPepiSession<T>(
  op: (session: PepiSession) => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session = new PepiSession();
    try {
      await session.login();
      return await op(session);
    } catch (error) {
      lastError = error;
      if (!(error instanceof PepiUnavailableError)) throw error;
      // Timeout não se resolve com retry (só dobra a espera) — aborta já.
      if (error.cause instanceof Error && error.cause.name === "TimeoutError") throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new PepiUnavailableError("pePI indisponível após retry.");
}

/** Acentos fora: o pePI é sensível ao encoding do termo, não à acentuação. */
function asciiTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Operações de MARCAS (MarcasServletController)
// ---------------------------------------------------------------------------

const MARCAS = "/pePI/servlet/MarcasServletController";

export async function fetchTrademarksByName(
  session: PepiSession,
  options: { name: string; exact?: boolean; niceClass?: string; perPage?: number }
): Promise<string> {
  const html = await session.postForm(MARCAS, {
    Action: "searchMarca",
    tipoPesquisa: "BY_MARCA_CLASSIF_BASICA",
    buscaExata: options.exact === false ? "nao" : "sim",
    txt: "",
    marca: asciiTerm(options.name),
    classeInter: options.niceClass?.replace(/\D/g, "") ?? "",
    registerPerPage: String(options.perPage ?? 100),
    botao: " pesquisar » ",
  });
  if (isLoginPage(html)) throw new PepiUnavailableError("Sessão pePI expirou na busca por nome.");
  return html;
}

export async function fetchTrademarksByNumbers(
  session: PepiSession,
  options: { processNumber?: string; gruNumber?: string; protocolNumber?: string }
): Promise<string> {
  const html = await session.postForm(MARCAS, {
    Action: "searchMarca",
    tipoPesquisa: "BY_NUM_PROC",
    NumPedido: options.processNumber?.replace(/\D/g, "") ?? "",
    NumGRU: options.gruNumber?.trim() ?? "",
    NumProtocolo: options.protocolNumber?.replace(/\D/g, "") ?? "",
    NumInscricaoInternacional: "",
    botao: " pesquisar » ",
  });
  if (isLoginPage(html)) throw new PepiUnavailableError("Sessão pePI expirou na busca por número.");
  return html;
}

/**
 * Busca por titular em dois passos: lista de titulares aproximados e,
 * para cada `pos`, a lista de processos daquele titular (estado na sessão).
 */
export async function fetchHolderMatches(
  session: PepiSession,
  options: { holder?: string; document?: string; perPage?: number }
): Promise<string> {
  const html = await session.postForm(MARCAS, {
    Action: "searchNome",
    tipoPesquisa: "BY_CNPJ_NOME",
    precisao: "aproximacao",
    cpf_cgc_numINPI: options.document?.replace(/\D/g, "") ?? "",
    nomeTitular: options.holder ? asciiTerm(options.holder) : "",
    registerPerPage: String(options.perPage ?? 100),
    botao: " pesquisar » ",
  });
  if (isLoginPage(html)) throw new PepiUnavailableError("Sessão pePI expirou na busca por titular.");
  return html;
}

export async function fetchHolderTrademarks(session: PepiSession, pos: number): Promise<string> {
  const html = await session.request(
    `${MARCAS}?Action=searchMarca&tipoPesquisa=BY_CNPJ_NOME&pos=${pos}`
  );
  if (isLoginPage(html)) throw new PepiUnavailableError("Sessão pePI expirou ao abrir titular.");
  return html;
}

export async function fetchTrademarkDetail(session: PepiSession, codPedido: string): Promise<string> {
  const html = await session.request(`${MARCAS}?Action=detail&CodPedido=${codPedido}`);
  if (isLoginPage(html)) throw new PepiUnavailableError("Sessão pePI expirou no detalhe da marca.");
  return html;
}

// ---------------------------------------------------------------------------
// Operações de PATENTES (PatenteServletController)
// ---------------------------------------------------------------------------

const PATENTES = "/pePI/servlet/PatenteServletController";

export type PatentSearchColumn =
  | "Titulo"
  | "Resumo"
  | "NomeDepositante"
  | "NomeInventor"
  | "CpfCnpjDepositante";

export async function fetchPatentsByExpression(
  session: PepiSession,
  options: { expression: string; column: PatentSearchColumn; perPage?: number }
): Promise<string> {
  // Busca textual de patentes é lenta no INPI — usa o timeout estendido.
  const html = await session.postForm(
    PATENTES,
    {
      Action: "SearchBasico",
      NumPedido: "",
      NumGru: "",
      NumProtocolo: "",
      FormaPesquisa: "todasPalavras",
      ExpressaoPesquisa: asciiTerm(options.expression),
      Coluna: options.column,
      RegisterPerPage: String(options.perPage ?? 100),
      botao: " pesquisar » ",
    },
    { timeoutMs: PEPI_SLOW_TIMEOUT_MS }
  );
  if (isLoginPage(html)) throw new PepiUnavailableError("Sessão pePI expirou na busca de patentes.");
  return html;
}

export async function fetchPatentsByNumbers(
  session: PepiSession,
  options: { processNumber?: string; gruNumber?: string; protocolNumber?: string }
): Promise<string> {
  const html = await session.postForm(PATENTES, {
    Action: "SearchBasico",
    NumPedido: options.processNumber?.trim() ?? "",
    NumGru: options.gruNumber?.trim() ?? "",
    NumProtocolo: options.protocolNumber?.replace(/\D/g, "") ?? "",
    FormaPesquisa: "todasPalavras",
    ExpressaoPesquisa: "",
    Coluna: "Titulo",
    RegisterPerPage: "20",
    botao: " pesquisar » ",
  });
  if (isLoginPage(html)) throw new PepiUnavailableError("Sessão pePI expirou na busca de patente por número.");
  return html;
}

export async function fetchPatentDetail(session: PepiSession, codPedido: string): Promise<string> {
  const html = await session.request(`${PATENTES}?Action=detail&CodPedido=${codPedido}`);
  if (isLoginPage(html)) throw new PepiUnavailableError("Sessão pePI expirou no detalhe da patente.");
  return html;
}
