import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
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
import { UpdateInpiBaseButton } from "@/components/inpi/sync-buttons";

export const metadata = { title: "Importações INPI" };

const statusVariants: Record<string, "secondary" | "warning" | "success" | "destructive"> = {
  PENDING: "secondary",
  RUNNING: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  RUNNING: "Executando",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
};

function durationOf(start: Date | null, end: Date | null): string {
  if (!start || !end) return "—";
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}min`;
}

export default async function InpiImportsPage() {
  await getAppSession();

  const jobs = await prisma.inpiImportJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      source: { select: { name: true } },
      rawFiles: { select: { fileName: true } },
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Histórico de importações da base. Cada arquivo baixado do INPI fica arquivado com
          verificação de integridade — é possível auditar a origem de qualquer dado da base.
        </p>
        <UpdateInpiBaseButton />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Origem</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Registros</TableHead>
                <TableHead>Falhas</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhuma importação executada ainda. Use “Atualizar base do INPI”.
                  </TableCell>
                </TableRow>
              )}
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="pl-4">
                    <p className="font-medium">{job.source?.name ?? job.sourceType}</p>
                    {job.errorMessage && (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-destructive">
                        {job.errorMessage}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {job.entityType === "TRADEMARK"
                        ? "Marcas"
                        : job.entityType === "PATENT"
                          ? "Patentes"
                          : job.entityType === "SOFTWARE"
                            ? "Prog. de computador"
                            : "RPI"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                    {job.rawFiles.map((f) => f.fileName).join(", ") || job.fileName || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {job.processedRecords}/{job.totalRecords}
                  </TableCell>
                  <TableCell>
                    {job.failedRecords > 0 ? (
                      <Badge variant="destructive">{job.failedRecords}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {durationOf(job.startedAt, job.finishedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[job.status] ?? "secondary"}>
                      {statusLabels[job.status] ?? job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(job.startedAt ?? job.createdAt)}
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
