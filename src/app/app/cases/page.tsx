import Link from "next/link";
import type { CaseType, RiskLevel } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { caseStatusLabel, caseTypeLabels, riskLabels, riskVariants } from "@/lib/labels";
import { caseTypeEnum, riskLevelEnum } from "@/lib/validators";
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
import { CaseFilters } from "@/components/cases/case-filters";
import { CaseFormDialog } from "@/components/cases/case-form-dialog";

export const metadata = { title: "Processos" };

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await getAppSession();
  const sp = await searchParams;

  const clientId = typeof sp.clientId === "string" ? sp.clientId : undefined;
  const typeParam = typeof sp.type === "string" ? sp.type : undefined;
  const riskParam = typeof sp.riskLevel === "string" ? sp.riskLevel : undefined;

  const type = caseTypeEnum.safeParse(typeParam).success ? (typeParam as CaseType) : undefined;
  const riskLevel = riskLevelEnum.safeParse(riskParam).success
    ? (riskParam as RiskLevel)
    : undefined;

  const [cases, clients] = await Promise.all([
    prisma.industrialPropertyCase.findMany({
      where: {
        organizationId,
        ...(clientId ? { clientId } : {}),
        ...(type ? { type } : {}),
        ...(riskLevel ? { riskLevel } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { documents: true, alerts: true, deadlines: true } },
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
        title="Processos"
        description="Processos de propriedade industrial da organização."
      >
        <CaseFormDialog clients={clients} />
      </PageHeader>

      <CaseFilters clients={clients} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Nº processo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Docs</TableHead>
                <TableHead>Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhum processo encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
              {cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/app/cases/${c.id}`} className="hover:underline">
                      {c.title}
                    </Link>
                  </TableCell>
                  <TableCell>{caseTypeLabels[c.type]}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.client?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.processNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{caseStatusLabel(c.status)}</TableCell>
                  <TableCell>
                    <Badge variant={riskVariants[c.riskLevel]}>{riskLabels[c.riskLevel]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c._count.documents}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(c.updatedAt)}
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
