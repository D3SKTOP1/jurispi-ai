import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, withApi } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";
import { isAllowedMimeType } from "@/lib/documents/text-extraction";
import { enqueueDocumentProcessing } from "@/lib/jobs/queues";
import { assertCaseInOrg, assertClientInOrg } from "@/lib/org-guard";
import { getStorage } from "@/lib/storage/storage";
import { documentUploadMetaSchema } from "@/lib/validators";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Vercel: extração + chunking + embeddings rodam via after() após a resposta.
export const maxDuration = 60;

export const POST = withApi(async (req) => {
  const { organizationId, userId } = await requireAuth();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "Envie o arquivo como multipart/form-data.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(400, "Campo 'file' é obrigatório.");
  }

  if (file.size === 0) throw new ApiError(400, "Arquivo vazio.");
  if (file.size > MAX_FILE_SIZE) {
    throw new ApiError(400, "Arquivo excede o limite de 20 MB.");
  }

  // Markdown costuma chegar sem MIME correto; normaliza pela extensão.
  let mimeType = file.type || "application/octet-stream";
  if (mimeType === "application/octet-stream" || mimeType === "text/x-markdown") {
    if (file.name.endsWith(".md")) mimeType = "text/markdown";
    if (file.name.endsWith(".txt")) mimeType = "text/plain";
  }

  if (!isAllowedMimeType(mimeType)) {
    throw new ApiError(400, "Tipo de arquivo não permitido. Envie PDF, TXT ou Markdown.");
  }

  const meta = documentUploadMetaSchema.parse({
    title: form.get("title") ?? undefined,
    clientId: form.get("clientId") ?? undefined,
    caseId: form.get("caseId") ?? undefined,
    sourceType: form.get("sourceType") ?? undefined,
  });

  await assertClientInOrg(meta.clientId, organizationId);
  await assertCaseInOrg(meta.caseId, organizationId);

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  const { key } = await storage.save({
    buffer,
    fileName: file.name,
    organizationId,
    contentType: mimeType,
  });

  const document = await prisma.document.create({
    data: {
      organizationId,
      clientId: meta.clientId ?? null,
      caseId: meta.caseId ?? null,
      title: meta.title ?? file.name,
      fileName: file.name,
      fileUrl: key,
      mimeType,
      sizeBytes: file.size,
      sourceType: meta.sourceType ?? "USER_UPLOAD",
      status: "UPLOADED",
    },
  });

  await enqueueDocumentProcessing(document.id);

  await logAudit({
    organizationId,
    userId,
    action: "document.uploaded",
    entityType: "Document",
    entityId: document.id,
    metadata: { fileName: file.name, sizeBytes: file.size },
  });

  return NextResponse.json({ document }, { status: 201 });
});
