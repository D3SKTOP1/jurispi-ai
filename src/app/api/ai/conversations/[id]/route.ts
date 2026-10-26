import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { notFound, withApi } from "@/lib/api-utils";
import { chatService } from "@/lib/ai/chat-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { organizationId } = await requireAuth();

  const conversation = await chatService.getConversation(organizationId, id);
  if (!conversation) notFound("Conversa");

  return NextResponse.json({ conversation });
});
