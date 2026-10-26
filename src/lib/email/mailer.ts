import "server-only";

/**
 * Envio de e-mail transacional via API HTTP da Resend.
 *
 * Sem `RESEND_API_KEY` (dev), NÃO falha: registra o e-mail no log e segue —
 * assim o app funciona localmente sem provedor. Em produção, defina
 * `RESEND_API_KEY` e `EMAIL_FROM` (com domínio verificado na Resend).
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? "JurisPI <onboarding@resend.dev>";
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = Array.isArray(input.to) ? input.to : [input.to];

  if (!apiKey) {
    console.info(
      `[email] (sem RESEND_API_KEY — não enviado) para=${to.join(",")} assunto="${input.subject}"`
    );
    return { sent: false, skipped: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        from: fromAddress(),
        to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend HTTP ${res.status}: ${detail.slice(0, 300)}`);
      return { sent: false, error: `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.error("[email] falha ao enviar:", error);
    return { sent: false, error: error instanceof Error ? error.message : "erro" };
  }
}

/** Layout mínimo e sóbrio para e-mails do produto. */
export function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f6f7;font-family:Arial,Helvetica,sans-serif;color:#10212a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="font-weight:700;font-size:18px;color:#0d5c6b;margin-bottom:16px;">JurisPI</div>
    <div style="background:#fff;border:1px solid #dbe1e2;border-radius:12px;padding:24px;">
      <h1 style="font-size:18px;margin:0 0 12px;">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="font-size:12px;color:#6d7f85;margin-top:16px;">
      Mensagem automática do JurisPI — inteligência em propriedade industrial.
      Análise assistiva; não substitui a conferência oficial no INPI.
    </p>
  </div></body></html>`;
}

/** Escapa texto para interpolar com segurança em HTML de e-mail. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
