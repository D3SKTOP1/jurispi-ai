import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { listUserOrganizations } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { OrgSwitcher } from "@/components/org-switcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const { organizationId, userId } = await getAppSession();
  const userOrgs = await listUserOrganizations(userId);

  const [organization, members, auditLogs] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const aiProvider = process.env.AI_PROVIDER ?? "mock";
  const storageProvider = process.env.STORAGE_PROVIDER ?? "local";
  const redisConfigured = Boolean(process.env.REDIS_URL);

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Organização, membros, infraestrutura e trilha de auditoria."
      >
        <OrgSwitcher organizations={userOrgs} activeId={organizationId} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Nome: </span>
              {organization?.name}
            </p>
            <p>
              <span className="text-muted-foreground">Slug: </span>
              {organization?.slug}
            </p>
            <p>
              <span className="text-muted-foreground">Criada em: </span>
              {formatDate(organization?.createdAt)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Infraestrutura</CardTitle>
            <CardDescription>Configuração atual definida no .env do servidor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Provider de IA:</span>
              <Badge variant={aiProvider === "mock" ? "warning" : "success"}>{aiProvider}</Badge>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Storage:</span>
              <Badge variant="secondary">{storageProvider}</Badge>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Fila de jobs:</span>
              <Badge variant={redisConfigured ? "success" : "secondary"}>
                {redisConfigured ? "BullMQ (Redis)" : "Inline (sem Redis)"}
              </Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Membros</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="pl-6 font-medium">{member.user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{member.user.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === "ADMIN" ? "gold" : "secondary"}>
                        {member.role}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auditoria recente</CardTitle>
            <CardDescription>Últimas 20 ações registradas.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {auditLogs.length === 0 && (
              <p className="text-muted-foreground">Nenhuma ação registrada ainda.</p>
            )}
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-2 border-b pb-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.entityType} · {log.user?.name ?? "sistema"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(log.createdAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Alert variant="info" className="mt-4">
        <AlertTitle>Sobre a IA da plataforma</AlertTitle>
        <AlertDescription>
          As respostas e documentos gerados pela IA são assistivos e não substituem advogado,
          agente da propriedade industrial ou consulta oficial ao INPI. Sempre revise o conteúdo
          gerado antes de utilizá-lo.
        </AlertDescription>
      </Alert>
    </div>
  );
}
