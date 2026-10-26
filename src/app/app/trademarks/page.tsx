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
import { TrademarkFormDialog } from "@/components/trademarks/trademark-form-dialog";
import { GenerateTrademarkOpinionDialog } from "@/components/ai/generate-trademark-opinion-dialog";

export const metadata = { title: "Marcas" };

export default async function TrademarksPage() {
  const { organizationId } = await getAppSession();

  const [trademarks, clients] = await Promise.all([
    prisma.trademarkCase.findMany({
      where: { case: { organizationId } },
      orderBy: { brandName: "asc" },
      include: {
        case: {
          select: {
            id: true,
            processNumber: true,
            status: true,
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
        title="Marcas"
        description="Carteira de marcas, classes de Nice, risco de colisão e pareceres assistidos."
      >
        <TrademarkFormDialog clients={clients} />
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Marca</TableHead>
                <TableHead>Classes Nice</TableHead>
                <TableHead>Apresentação</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Nº processo</TableHead>
                <TableHead>Depósito</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risco de colisão</TableHead>
                <TableHead className="w-52" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {trademarks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Nenhuma marca cadastrada.
                  </TableCell>
                </TableRow>
              )}
              {trademarks.map((tm) => (
                <TableRow key={tm.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/app/cases/${tm.case.id}`} className="hover:underline">
                      {tm.brandName}
                    </Link>
                    {tm.aiAnalysis && (
                      <Badge variant="gold" className="ml-2">
                        Parecer IA
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tm.niceClasses.length === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {tm.niceClasses.map((c) => (
                        <Badge key={c} variant="secondary">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tm.presentationType ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tm.holderName ?? tm.case.client?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tm.case.processNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(tm.applicationDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tm.currentStatus ?? tm.case.status}
                  </TableCell>
                  <TableCell>
                    <Badge variant={riskVariants[tm.collisionRisk]}>
                      {riskLabels[tm.collisionRisk]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <GenerateTrademarkOpinionDialog
                      caseId={tm.case.id}
                      brandName={tm.brandName}
                      niceClasses={tm.niceClasses}
                      buttonLabel="Gerar parecer"
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
