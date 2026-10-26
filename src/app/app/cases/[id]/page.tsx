import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, FileOutput } from "lucide-react";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import {
  alertSeverityLabels,
  alertSeverityVariants,
  alertStatusLabels,
  caseStatusLabel,
  caseTypeLabels,
  deadlineStatusLabels,
  deadlineStatusVariants,
  documentStatusLabels,
  documentStatusVariants,
  generatedDocTypeLabels,
  riskLabels,
  riskVariants,
} from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { CaseFormDialog } from "@/components/cases/case-form-dialog";
import { EnrichFromInpiButton } from "@/components/cases/enrich-from-inpi-button";
import { GenerateTrademarkOpinionDialog } from "@/components/ai/generate-trademark-opinion-dialog";
import { GeneratePatentAnalysisDialog } from "@/components/ai/generate-patent-analysis-dialog";
import { AlertFormDialog } from "@/components/alerts/alert-form-dialog";
import { AlertActions } from "@/components/alerts/alert-actions";
import { DeadlineFormDialog } from "@/components/deadlines/deadline-form-dialog";
import { DeadlineActions } from "@/components/deadlines/deadline-actions";

export const metadata = { title: "Processo" };

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organizationId } = await getAppSession();

  const [ipCase, clients] = await Promise.all([
    prisma.industrialPropertyCase.findFirst({
      where: { id, organizationId },
      include: {
        client: { select: { id: true, name: true } },
        trademark: true,
        patent: true,
        industrialDesign: true,
        software: true,
        documents: { orderBy: { createdAt: "desc" } },
        alerts: { orderBy: { createdAt: "desc" } },
        deadlines: { orderBy: { dueDate: "asc" } },
        generatedDocuments: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.client.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!ipCase) notFound();

  const aiAnalysis = ipCase.trademark?.aiAnalysis ?? ipCase.patent?.aiAnalysis ?? null;

  return (
    <div>
      <PageHeader
        title={ipCase.title}
        description={`${caseTypeLabels[ipCase.type]}${ipCase.processNumber ? ` · Processo nº ${ipCase.processNumber}` : ""}${ipCase.client ? ` · Cliente: ${ipCase.client.name}` : ""}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/ai-chat?caseId=${ipCase.id}`}>
            <Bot className="h-4 w-4" />
            Chat de IA do processo
          </Link>
        </Button>
        {ipCase.type === "TRADEMARK" && ipCase.trademark && (
          <GenerateTrademarkOpinionDialog
            caseId={ipCase.id}
            brandName={ipCase.trademark.brandName}
            niceClasses={ipCase.trademark.niceClasses}
          />
        )}
        {ipCase.type === "PATENT" && ipCase.patent && (
          <GeneratePatentAnalysisDialog
            caseId={ipCase.id}
            title={ipCase.patent.title}
            abstract={ipCase.patent.abstract ?? undefined}
            ipcClasses={ipCase.patent.ipcClasses}
          />
        )}
        {(ipCase.type === "TRADEMARK" || ipCase.type === "PATENT") && (
          <EnrichFromInpiButton caseId={ipCase.id} disabled={!ipCase.processNumber} />
        )}
        <CaseFormDialog clients={clients} existingCase={ipCase} />
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Situação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span> {caseStatusLabel(ipCase.status)}
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Risco:</span>
              <Badge variant={riskVariants[ipCase.riskLevel]}>{riskLabels[ipCase.riskLevel]}</Badge>
            </p>
            <p>
              <span className="text-muted-foreground">Próximo passo: </span>
              {ipCase.nextStep ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {ipCase.summary ?? "Sem resumo cadastrado."}
            </p>
            {ipCase.trademark && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="gold">Marca: {ipCase.trademark.brandName}</Badge>
                {ipCase.trademark.niceClasses.map((c) => (
                  <Badge key={c} variant="secondary">
                    Nice {c}
                  </Badge>
                ))}
              </div>
            )}
            {ipCase.patent && ipCase.patent.ipcClasses.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {ipCase.patent.ipcClasses.map((c) => (
                  <Badge key={c} variant="secondary">
                    IPC {c}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documentos ({ipCase.documents.length})</TabsTrigger>
          <TabsTrigger value="alerts">Alertas ({ipCase.alerts.length})</TabsTrigger>
          <TabsTrigger value="deadlines">Prazos ({ipCase.deadlines.length})</TabsTrigger>
          <TabsTrigger value="generated">
            Docs. gerados ({ipCase.generatedDocuments.length})
          </TabsTrigger>
          {aiAnalysis && <TabsTrigger value="analysis">Análise da IA</TabsTrigger>}
        </TabsList>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Título</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enviado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipCase.documents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        Nenhum documento vinculado. Envie documentos na área{" "}
                        <Link href="/app/documents" className="underline">
                          Documentos
                        </Link>
                        .
                      </TableCell>
                    </TableRow>
                  )}
                  {ipCase.documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="pl-4 font-medium">{doc.title}</TableCell>
                      <TableCell className="text-muted-foreground">{doc.fileName}</TableCell>
                      <TableCell>
                        <Badge variant={documentStatusVariants[doc.status]}>
                          {documentStatusLabels[doc.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="mb-3 flex justify-end">
            <AlertFormDialog fixedCaseId={ipCase.id} />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Título</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data limite</TableHead>
                    <TableHead className="w-48" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipCase.alerts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        Nenhum alerta para este processo.
                      </TableCell>
                    </TableRow>
                  )}
                  {ipCase.alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="pl-4 font-medium">{alert.title}</TableCell>
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
                      <TableCell>
                        <AlertActions alertId={alert.id} status={alert.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deadlines">
          <div className="mb-3 flex justify-end">
            <DeadlineFormDialog fixedCaseId={ipCase.id} />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Título</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipCase.deadlines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        Nenhum prazo para este processo.
                      </TableCell>
                    </TableRow>
                  )}
                  {ipCase.deadlines.map((deadline) => (
                    <TableRow key={deadline.id}>
                      <TableCell className="pl-4 font-medium">{deadline.title}</TableCell>
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
        </TabsContent>

        <TabsContent value="generated">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipCase.generatedDocuments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        Nenhum documento gerado para este processo.
                      </TableCell>
                    </TableRow>
                  )}
                  {ipCase.generatedDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="pl-4 font-medium">{doc.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {generatedDocTypeLabels[doc.type]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/app/generated-documents/${doc.id}`}>
                            <FileOutput className="h-4 w-4" />
                            Abrir
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {aiAnalysis && (
          <TabsContent value="analysis">
            <Card>
              <CardContent className="p-6">
                <p className="whitespace-pre-wrap text-sm">{aiAnalysis}</p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
