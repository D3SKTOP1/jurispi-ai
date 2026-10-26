import Link from "next/link";
import {
  Award,
  Bell,
  Bot,
  Briefcase,
  CalendarClock,
  FileText,
  Lightbulb,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/utils";
import { documentStatusLabels, documentStatusVariants } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { organizationId, userName } = await getAppSession();
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalCases,
    trademarkCases,
    patentCases,
    openAlerts,
    upcomingDeadlines,
    processedDocuments,
    latestDocuments,
    latestConversations,
  ] = await Promise.all([
    prisma.industrialPropertyCase.count({ where: { organizationId } }),
    prisma.industrialPropertyCase.count({ where: { organizationId, type: "TRADEMARK" } }),
    prisma.industrialPropertyCase.count({ where: { organizationId, type: "PATENT" } }),
    prisma.alert.count({ where: { organizationId, status: "OPEN" } }),
    prisma.deadline.count({
      where: { organizationId, status: "PENDING", dueDate: { gte: now, lte: nextWeek } },
    }),
    prisma.document.count({ where: { organizationId, status: "READY" } }),
    prisma.document.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
    prisma.aiConversation.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        case: { select: { title: true } },
      },
    }),
  ]);

  const stats = [
    { label: "Total de processos", value: totalCases, icon: Briefcase, href: "/app/cases" },
    { label: "Processos de marca", value: trademarkCases, icon: Award, href: "/app/trademarks" },
    { label: "Processos de patente", value: patentCases, icon: Lightbulb, href: "/app/patents" },
    { label: "Alertas abertos", value: openAlerts, icon: Bell, href: "/app/alerts" },
    {
      label: "Prazos próximos (7 dias)",
      value: upcomingDeadlines,
      icon: CalendarClock,
      href: "/app/deadlines",
    },
    {
      label: "Documentos processados",
      value: processedDocuments,
      icon: FileText,
      href: "/app/documents",
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Bem-vindo(a), ${userName.split(" ")[0]}`}
        description="Visão geral da sua carteira de propriedade industrial."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-semibold leading-none">{stat.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Últimos documentos enviados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestDocuments.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum documento enviado ainda.</p>
            )}
            {latestDocuments.map((doc) => (
              <Link
                key={doc.id}
                href="/app/documents"
                className="flex items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                </div>
                <Badge variant={documentStatusVariants[doc.status]}>
                  {documentStatusLabels[doc.status]}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" />
              Últimas conversas com IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestConversations.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma conversa iniciada ainda.</p>
            )}
            {latestConversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/app/ai-chat?conversationId=${conv.id}`}
                className="flex items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{conv.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {conv.case ? `Processo: ${conv.case.title} · ` : ""}
                    {formatDateTime(conv.updatedAt)}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
