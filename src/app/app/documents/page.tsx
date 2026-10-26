import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import {
  documentSourceLabels,
  documentStatusLabels,
  documentStatusVariants,
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
import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog";
import { DocumentRowActions } from "@/components/documents/document-row-actions";

export const metadata = { title: "Documentos" };

export default async function DocumentsPage() {
  const { organizationId } = await getAppSession();

  const [documents, clients, cases] = await Promise.all([
    prisma.document.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
        case: { select: { title: true } },
        _count: { select: { chunks: true } },
      },
    }),
    prisma.client.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
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
        title="Documentos"
        description="Base de conhecimento da organização: uploads, despachos, legislação e manuais."
      >
        <DocumentUploadDialog clients={clients} cases={cases} />
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Título</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead className="w-56" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhum documento enviado. Envie o primeiro documento para alimentar o RAG.
                  </TableCell>
                </TableRow>
              )}
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="pl-4">
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                    {doc.status === "ERROR" && doc.errorMessage && (
                      <p className="mt-1 text-xs text-destructive">{doc.errorMessage}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {documentSourceLabels[doc.sourceType]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.client?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.case?.title ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{doc._count.chunks}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={documentStatusVariants[doc.status]}>
                      {documentStatusLabels[doc.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(doc.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DocumentRowActions documentId={doc.id} status={doc.status} />
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
