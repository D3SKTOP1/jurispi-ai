import Link from "next/link";
import { FileOutput } from "lucide-react";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import {
  generatedDocStatusLabels,
  generatedDocStatusVariants,
  generatedDocTypeLabels,
} from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const metadata = { title: "Documentos gerados" };

export default async function GeneratedDocumentsPage() {
  const { organizationId } = await getAppSession();

  const documents = await prisma.generatedDocument.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: { case: { select: { id: true, title: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Documentos gerados"
        description="Pareceres, análises e rascunhos gerados com apoio da IA. Revise antes de usar."
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum documento gerado. Use os botões de IA nas áreas de Marcas e Patentes.
                  </TableCell>
                </TableRow>
              )}
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link
                      href={`/app/generated-documents/${doc.id}`}
                      className="hover:underline"
                    >
                      {doc.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {generatedDocTypeLabels[doc.type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.case ? (
                      <Link href={`/app/cases/${doc.case.id}`} className="hover:underline">
                        {doc.case.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={generatedDocStatusVariants[doc.status]}>
                      {generatedDocStatusLabels[doc.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(doc.createdAt)}
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
    </div>
  );
}
