import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { generatedDocTypeLabels } from "@/lib/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { GeneratedDocumentEditor } from "@/components/generated-documents/generated-document-editor";

export const metadata = { title: "Documento gerado" };

export default async function GeneratedDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organizationId } = await getAppSession();

  const document = await prisma.generatedDocument.findFirst({
    where: { id, organizationId },
    include: { case: { select: { id: true, title: true } } },
  });
  if (!document) notFound();

  return (
    <div>
      <PageHeader
        title={generatedDocTypeLabels[document.type]}
        description={
          document.case ? `Vinculado ao processo: ${document.case.title}` : "Sem processo vinculado"
        }
      >
        {document.case && (
          <Link
            href={`/app/cases/${document.case.id}`}
            className="text-sm text-primary hover:underline"
          >
            Ver processo →
          </Link>
        )}
      </PageHeader>

      <Alert variant="gold" className="mb-4">
        <AlertDescription>
          Documento gerado com apoio de IA. Conteúdo assistivo — revise antes de utilizar; não
          substitui advogado, agente da propriedade industrial ou consulta oficial ao INPI.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-6">
          <GeneratedDocumentEditor document={document} />
        </CardContent>
      </Card>
    </div>
  );
}
