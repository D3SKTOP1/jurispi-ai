import Link from "next/link";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { deadlineStatusLabels, deadlineStatusVariants } from "@/lib/labels";
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
import { DeadlineFormDialog } from "@/components/deadlines/deadline-form-dialog";
import { DeadlineActions } from "@/components/deadlines/deadline-actions";

export const metadata = { title: "Prazos" };

export default async function DeadlinesPage() {
  const { organizationId } = await getAppSession();

  const [deadlines, cases] = await Promise.all([
    prisma.deadline.findMany({
      where: { organizationId },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
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
        title="Prazos"
        description="Prazos administrativos e internos. Despachos da RPI em processos monitorados geram prazos automáticos (marcados “auto · RPI”, estimados — confira a contagem oficial); prazos vencidos geram alertas."
      >
        <DeadlineFormDialog cases={cases} />
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Prazo</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deadlines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum prazo cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {deadlines.map((deadline) => (
                <TableRow key={deadline.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{deadline.title}</p>
                      {deadline.source === "RPI" && (
                        <Badge variant="secondary" title="Prazo estimado a partir de um despacho da RPI — confira a contagem oficial.">
                          auto · RPI
                        </Badge>
                      )}
                    </div>
                    {deadline.description && (
                      <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                        {deadline.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {deadline.case ? (
                      <Link href={`/app/cases/${deadline.case.id}`} className="hover:underline">
                        {deadline.case.title}
                      </Link>
                    ) : deadline.processNumber ? (
                      <Link
                        href={`/app/inpi/trademarks/${deadline.processNumber}`}
                        className="hover:underline"
                      >
                        {deadline.processNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(deadline.dueDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={deadlineStatusVariants[deadline.status]}>
                      {deadlineStatusLabels[deadline.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DeadlineActions deadlineId={deadline.id} status={deadline.status} />
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
