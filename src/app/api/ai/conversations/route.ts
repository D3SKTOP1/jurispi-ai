import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api-utils";
import { chatService } from "@/lib/ai/chat-service";

export const GET = withApi(async () => {
  const { organizationId } = await requireAuth();
  const conversations = await chatService.listConversations(organizationId);
  return NextResponse.json({ conversations });
});
