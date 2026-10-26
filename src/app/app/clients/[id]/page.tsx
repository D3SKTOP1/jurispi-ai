import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import {
  caseTypeLabels,
  documentStatusLabels,
  documentStatusVariants,
  riskLabels,
  riskVariants,
} from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import { ClientFormDialog } from "@/components/clients/client-form-dialog";

export const metadata = { title: "Cliente" };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organizationId } = await getAppSession();

  const client = await prisma.client.findFirst({
    where: { id, organizationId },
    include: {
      cases: {
        orderBy: { updatedAt: "desc" },
        include: { trademark: true, patent: true },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) notFound();

  return (
    <div>
      <PageHeader title={client.name} description="Detalhes do cliente, processos e documentos vinculados.">
        <ClientFormDialog client={client} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados cadastrais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">CPF/CNPJ: </span>
              {client.documentNumber ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">E-mail: </span>
              {client.email ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Telefone: </span>
              {client.phone ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Cliente desde: </span>
              {formatDate(client.createdAt)}
            </p>
            {client.notes && (
              <p className="whitespace-pre-wrap border-t pt-2 text-muted-foreground">
                {client.notes}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Vínculos</CardTitle>
            <CardDescription>Processos e documentos deste cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="cases">
              <TabsList>
                <TabsTrigger value="cases">Processos ({client.cases.length})</TabsTrigger>
                <TabsTrigger value="documents">Documentos ({client.documents.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="cases">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Risco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.cases.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                          Nenhum processo vinculado.
                        </TableCell>
                      </TableRow>
                    )}
                    {client.cases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <Link href={`/app/cases/${c.id}`} className="hover:underline">
                            {c.title}
                          </Link>
                        </TableCell>
                        <TableCell>{caseTypeLabels[c.type]}</TableCell>
                        <TableCell className="text-muted-foreground">{c.status}</TableCell>
                        <TableCell>
                          <Badge variant={riskVariants[c.riskLevel]}>
                            {riskLabels[c.riskLevel]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="documents">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.documents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                          Nenhum documento vinculado.
                        </TableCell>
                      </TableRow>
                    )}
                    {client.documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
