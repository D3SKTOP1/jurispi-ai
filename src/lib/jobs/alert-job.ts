import { prisma } from "@/lib/db";
import { sendEmail, emailLayout, esc } from "@/lib/email/mailer";

const UPCOMING_WINDOW_DAYS = 7;

interface DeadlineRow {
  id: string;
  organizationId: string;
  caseId: string | null;
  title: string;
  dueDate: Date;
}

/**
 * Job de alertas de prazo:
 * - marca prazos vencidos como OVERDUE e cria alerta CRITICAL;
 * - cria alerta WARNING para prazos que vencem nos próximos 7 dias;
 * - envia um e-mail (digest) aos membros da organização com o que é NOVO.
 * Roda pelo cron diário (/api/cron/deadlines) ou pelo worker.
 */
export async function runDeadlineScan(): Promise<{
  overdue: number;
  upcoming: number;
  emailed: number;
}> {
  const now = new Date();
  const upcomingLimit = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Acumula, por organização, os prazos que geraram alerta NOVO nesta varredura.
  const newOverdueByOrg = new Map<string, DeadlineRow[]>();
  const newUpcomingByOrg = new Map<string, DeadlineRow[]>();

  // 1. Prazos vencidos ainda pendentes.
  const overdue = await prisma.deadline.findMany({
    where: { status: "PENDING", dueDate: { lt: now } },
  });
  for (const deadline of overdue) {
    await prisma.deadline.update({ where: { id: deadline.id }, data: { status: "OVERDUE" } });
    const created = await createAlertIfMissing({
      organizationId: deadline.organizationId,
      caseId: deadline.caseId,
      title: `Prazo vencido: ${deadline.title}`,
      description: `O prazo "${deadline.title}" venceu em ${deadline.dueDate.toLocaleDateString("pt-BR")}. Verifique as providências cabíveis.`,
      severity: "CRITICAL",
      dueDate: deadline.dueDate,
    });
    if (created) push(newOverdueByOrg, deadline);
  }

  // 2. Prazos próximos do vencimento.
  const upcoming = await prisma.deadline.findMany({
    where: { status: "PENDING", dueDate: { gte: now, lte: upcomingLimit } },
  });
  for (const deadline of upcoming) {
    const created = await createAlertIfMissing({
      organizationId: deadline.organizationId,
      caseId: deadline.caseId,
      title: `Prazo próximo: ${deadline.title}`,
      description: `O prazo "${deadline.title}" vence em ${deadline.dueDate.toLocaleDateString("pt-BR")}.`,
      severity: "WARNING",
      dueDate: deadline.dueDate,
    });
    if (created) push(newUpcomingByOrg, deadline);
  }

  // 3. E-mail (digest) por organização com o que é novo.
  const orgIds = new Set<string>([...newOverdueByOrg.keys(), ...newUpcomingByOrg.keys()]);
  let emailed = 0;
  for (const organizationId of orgIds) {
    const ok = await emailDeadlineDigest(
      organizationId,
      newOverdueByOrg.get(organizationId) ?? [],
      newUpcomingByOrg.get(organizationId) ?? []
    );
    if (ok) emailed += 1;
  }

  return { overdue: overdue.length, upcoming: upcoming.length, emailed };
}

function push(map: Map<string, DeadlineRow[]>, d: DeadlineRow) {
  const list = map.get(d.organizationId) ?? [];
  list.push(d);
  map.set(d.organizationId, list);
}

async function createAlertIfMissing(input: {
  organizationId: string;
  caseId: string | null;
  title: string;
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  dueDate: Date | null;
}): Promise<boolean> {
  const existing = await prisma.alert.findFirst({
    where: {
      organizationId: input.organizationId,
      caseId: input.caseId,
      title: input.title,
      status: "OPEN",
    },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.alert.create({
    data: {
      organizationId: input.organizationId,
      caseId: input.caseId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      status: "OPEN",
      dueDate: input.dueDate,
    },
  });
  return true;
}

function appUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "https://jurispi-ai.vercel.app").replace(/\/$/, "");
}

/** Envia o digest de prazos aos membros da organização. Retorna true se enviou. */
async function emailDeadlineDigest(
  organizationId: string,
  overdue: DeadlineRow[],
  upcoming: DeadlineRow[]
): Promise<boolean> {
  if (overdue.length === 0 && upcoming.length === 0) return false;

  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    include: { user: { select: { email: true } } },
  });
  const recipients = [...new Set(members.map((m) => m.user.email).filter(Boolean))];
  if (recipients.length === 0) return false;

  const item = (d: DeadlineRow) =>
    `<li style="margin-bottom:6px;">${esc(d.title)} — <strong>${d.dueDate.toLocaleDateString("pt-BR")}</strong></li>`;
  const sections: string[] = [];
  if (overdue.length) {
    sections.push(
      `<p style="font-size:14px;margin:12px 0 4px;color:#b91c1c;"><strong>Vencidos (${overdue.length})</strong></p><ul style="font-size:14px;padding-left:18px;margin:0;">${overdue.map(item).join("")}</ul>`
    );
  }
  if (upcoming.length) {
    sections.push(
      `<p style="font-size:14px;margin:12px 0 4px;color:#9a6410;"><strong>Vencem em breve (${upcoming.length})</strong></p><ul style="font-size:14px;padding-left:18px;margin:0;">${upcoming.map(item).join("")}</ul>`
    );
  }

  const total = overdue.length + upcoming.length;
  const result = await sendEmail({
    to: recipients,
    subject: `JurisPI — ${overdue.length ? `${overdue.length} prazo(s) vencido(s)` : `${upcoming.length} prazo(s) próximo(s)`}`,
    html: emailLayout(
      `Você tem ${total} prazo(s) que exigem atenção`,
      `${sections.join("")}
       <p style="margin:20px 0;"><a href="${appUrl()}/app/deadlines" style="background:#0d5c6b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block;">Ver prazos</a></p>`
    ),
  });
  return result.sent;
}
