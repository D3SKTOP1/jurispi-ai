import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
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
import { SyncRpiButton, UpdateInpiBaseButton } from "@/components/inpi/sync-buttons";

export const metadata = { title: "RPI" };

const statusVariants: Record<string, "secondary" | "warning" | "success" | "destructive"> = {
  DISCOVERED: "secondary",
  PROCESSING: "warning",
  PROCESSED: "success",
  FAILED: "destructive",
};

const statusLabels: Record<string, string> = {
  DISCOVERED: "Descoberta",
  PROCESSING: "Processando",
  PROCESSED: "Processada",
  FAILED: "Falhou",
};

export default async function InpiRpiPage() {
  await getAppSession();

  const issues = await prisma.rpiIssue.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: {
      sections: {
        include: { _count: { select: { dispatches: true } } },
      },
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Edições da Revista da Propriedade Industrial importadas para a plataforma. A RPI é
          publicada pelo INPI toda terça-feira; o PDF oficial de cada edição fica linkado abaixo.
        </p>
        <UpdateInpiBaseButton />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">RPI nº</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Seções</TableHead>
                <TableHead>Despachos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Revista oficial</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhuma edição importada ainda. Clique em “Atualizar base do INPI”.
                  </TableCell>
                </TableRow>
              )}
              {issues.map((issue) => {
                const totalDispatches = issue.sections.reduce(
                  (acc, s) => acc + s._count.dispatches,
                  0
                );
                return (
                  <TableRow key={issue.id}>
                    <TableCell className="pl-4 font-medium">{issue.number}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(issue.publishedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {issue.sections.length === 0 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {issue.sections.map((s) => (
                          <Badge key={s.id} variant="secondary">
                            {s.sectionCode}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{totalDispatches}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[issue.status] ?? "secondary"}>
                        {statusLabels[issue.status] ?? issue.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <a
                        href={`https://revistas.inpi.gov.br/pdf/Marcas${issue.number}.pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        PDF oficial
                      </a>
                    </TableCell>
                    <TableCell>
                      <SyncRpiButton rpiNumber={issue.number} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
