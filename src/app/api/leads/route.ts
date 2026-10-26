import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { parseBody, withApi } from "@/lib/api-utils";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendEmail, emailLayout, esc } from "@/lib/email/mailer";
import { leadSchema } from "@/lib/validators";

/**
 * Pedido de demonstração da landing page (público, sem login).
 * Grava o lead e notifica por e-mail (best-effort — falha de e-mail não
 * derruba o cadastro). Os leads aparecem no painel /app/admin.
 */
export const POST = withApi(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  await enforceRateLimit(`lead:${ip}`, 5, 60 * 60 * 1000);

  const data = await parseBody(req, leadSchema);

  const lead = await prisma.lead.create({
    data: {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone ?? null,
      firmName: data.firmName ?? null,
      message: data.message ?? null,
      source: "landing",
    },
  });

  const notify = process.env.LEADS_NOTIFY_EMAIL;
  if (notify) {
    await sendEmail({
      to: notify,
      subject: `Novo pedido de demonstração — ${lead.name}`,
      html: emailLayout(
        "Novo pedido de demonstração",
        `<p><strong>${esc(lead.name)}</strong> pediu uma demonstração do JurisPI AI.</p>
         <p>E-mail: ${esc(lead.email)}<br/>
         Telefone: ${esc(lead.phone ?? "—")}<br/>
         Escritório: ${esc(lead.firmName ?? "—")}</p>
         ${lead.message ? `<p>Mensagem: ${esc(lead.message)}</p>` : ""}`
      ),
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
});
