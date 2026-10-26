import { redirect } from "next/navigation";
import { Building2, LogIn, ShieldCheck, UserPlus, Users } from "lucide-react";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Administração da plataforma" };

function fmt(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Painel de administração da PLATAFORMA — todos os usuários, escritórios e
 * acessos, de todas as organizações. Restrito aos e-mails de
 * PLATFORM_ADMIN_EMAILS (padrão: dono do deploy).
 */
export default async function PlatformAdminPage() {
  const session = await getAppSession();
  if (!isPlatformAdmin(session.userEmail)) redirect("/app/dashboard");

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [users, organizations, logins7d, signups7d, recentLogins, leads] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        lastLoginAt: true,
        onboardedAt: true,
        memberships: {
          select: { role: true, organization: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      take: 500,
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { members: true, clients: true, cases: true } },
      },
      take: 200,
    }),
    prisma.auditLog.count({ where: { action: "auth.login", createdAt: { gte: since7d } } }),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.auditLog.findMany({
      where: { action: { in: ["auth.login", "auth.register"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        createdAt: true,
        metadata: true,
        user: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Administração da plataforma</h1>
          <p className="text-sm text-muted-foreground">
            Todos os usuários, escritórios e acessos da aplicação — visível apenas para
            administradores da plataforma.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Usuários cadastrados" value={users.length} />
        <StatCard icon={Building2} label="Escritórios (organizações)" value={organizations.length} />
        <StatCard icon={UserPlus} label="Novos cadastros (7 dias)" value={signups7d} />
        <StatCard icon={LogIn} label="Logins (7 dias)" value={logins7d} />
      </div>

      <Card>
        <CardContent className="space-y-3 p-6">
          <div>
            <p className="font-medium">Pedidos de demonstração (site)</p>
            <p className="text-sm text-muted-foreground">
              Leads enviados pelo formulário da página pública, mais recentes primeiro.
            </p>
          </div>
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido recebido ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Escritório</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-xs">{l.email}</TableCell>
                    <TableCell className="text-xs">{l.phone ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.firmName ?? "—"}</TableCell>
                    <TableCell className="max-w-64 text-xs text-muted-foreground">
                      <span className="line-clamp-2">{l.message ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmt(l.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <div>
            <p className="font-medium">Usuários</p>
            <p className="text-sm text-muted-foreground">
              Quem se cadastrou e quando entrou pela última vez. O último login passou a ser
              registrado em 14/07/2026 — contas que não entraram desde então aparecem com “—”.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Escritório(s)</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Último login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-xs">{u.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.memberships
                      .map((m) => `${m.organization.name} (${m.role})`)
                      .join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmt(u.createdAt)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmt(u.lastLoginAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <div>
            <p className="font-medium">Escritórios</p>
            <p className="text-sm text-muted-foreground">Organizações criadas na plataforma.</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Processos</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell>{o._count.members}</TableCell>
                  <TableCell>{o._count.clients}</TableCell>
                  <TableCell>{o._count.cases}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmt(o.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <div>
            <p className="font-medium">Últimos acessos</p>
            <p className="text-sm text-muted-foreground">
              Trilha de auditoria de logins e cadastros (50 mais recentes).
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Escritório</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogins.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground">{fmt(e.createdAt)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.action === "auth.register"
                          ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {e.action === "auth.register" ? "Cadastro" : "Login"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {e.user
                      ? `${e.user.name} <${e.user.email}>`
                      : ((e.metadata as { email?: string } | null)?.email ?? "—")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.organization?.name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {recentLogins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    Nenhum evento registrado ainda (a trilha de logins começou em 14/07/2026).
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
