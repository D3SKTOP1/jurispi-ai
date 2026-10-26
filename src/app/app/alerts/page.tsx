import Link from "next/link";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import {
  alertSeverityLabels,
  alertSeverityVariants,
  alertStatusLabels,
} from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { AlertFormDialog } from "@/components/alerts/alert-form-dialog";
import { AlertActions } from "@/components/alerts/alert-actions";

export const metadata = { title: "Alertas" };

export default async function AlertsPage() {
  const { organizationId } = await getAppSession();

  const [alerts, cases] = await Promise.all([
    prisma.alert.findMany({
      where: { organizationId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { case: { select: { id: true, title: true } } },
    }),
    prisma.industrialPropertyCase.findMany({
      where: { organizationId },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Alertas"
        description="Acompanhamento de eventos importantes: prazos, despachos e pendências."
      >
        <AlertFormDialog cases={cases} />
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Alerta</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data limite</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-52" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhum alerta registrado.
                  </TableCell>
                </TableRow>
              )}
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="pl-4">
                    <p className="font-medium">{alert.title}</p>
                    {alert.description && (
                      <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                        {alert.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {alert.case ? (
                      <Link href={`/app/cases/${alert.case.id}`} className="hover:underline">
                        {alert.case.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={alertSeverityVariants[alert.severity]}>
                      {alertSeverityLabels[alert.severity]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {alertStatusLabels[alert.status]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(alert.dueDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(alert.createdAt)}
                  </TableCell>
                  <TableCell>
                    <AlertActions alertId={alert.id} status={alert.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
