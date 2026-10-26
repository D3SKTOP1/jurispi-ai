import Link from "next/link";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { riskLabels, riskVariants } from "@/lib/labels";
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
import { PatentFormDialog } from "@/components/patents/patent-form-dialog";
import { GeneratePatentAnalysisDialog } from "@/components/ai/generate-patent-analysis-dialog";

export const metadata = { title: "Patentes" };

export default async function PatentsPage() {
  const { organizationId } = await getAppSession();

  const [patents, clients] = await Promise.all([
    prisma.patentCase.findMany({
      where: { case: { organizationId } },
      orderBy: { title: "asc" },
      include: {
        case: {
          select: {
            id: true,
            processNumber: true,
            status: true,
            riskLevel: true,
            client: { select: { name: true } },
          },
        },
      },
    }),
    prisma.client.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Patentes"
        description="Carteira de patentes, classificação IPC, datas e análises técnicas assistidas."
      >
        <PatentFormDialog clients={clients} />
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Título</TableHead>
                <TableHead>IPC</TableHead>
                <TableHead>Depositantes</TableHead>
                <TableHead>Nº processo</TableHead>
                <TableHead>Depósito</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead className="w-52" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {patents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhuma patente cadastrada.
                  </TableCell>
                </TableRow>
              )}
              {patents.map((pt) => (
                <TableRow key={pt.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/app/cases/${pt.case.id}`} className="hover:underline">
                      {pt.title}
                    </Link>
                    {pt.aiAnalysis && (
                      <Badge variant="gold" className="ml-2">
                        Análise IA
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {pt.ipcClasses.length === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {pt.ipcClasses.map((c) => (
                        <Badge key={c} variant="secondary">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pt.applicants.length > 0
                      ? pt.applicants.join(", ")
                      : (pt.case.client?.name ?? "—")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pt.case.processNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(pt.filingDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pt.currentStatus ?? pt.case.status}
                  </TableCell>
                  <TableCell>
                    <Badge variant={riskVariants[pt.case.riskLevel]}>
                      {riskLabels[pt.case.riskLevel]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <GeneratePatentAnalysisDialog
                      caseId={pt.case.id}
                      title={pt.title}
                      abstract={pt.abstract ?? undefined}
                      ipcClasses={pt.ipcClasses}
                      buttonLabel="Gerar análise"
                    />
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
