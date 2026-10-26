import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, withApi } from "@/lib/api-utils";
import { getStorage } from "@/lib/storage/storage";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { organizationId } = await requireAuth();

  const document = await prisma.document.findFirst({
    where: { id, organizationId },
    select: { fileUrl: true, fileName: true, mimeType: true },
  });
  if (!document) notFound("Documento");

  const buffer = await getStorage().read(document.fileUrl);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": document.mimeType,
      "content-disposition": `attachment; filename="${encodeURIComponent(document.fileName)}"`,
    },
  });
});
