import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { ChatInterface } from "@/components/chat/chat-interface";

export const metadata = { title: "Chat com IA" };

export default async function AiChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organizationId } = await getAppSession();
  const sp = await searchParams;

  const initialConversationId =
    typeof sp.conversationId === "string" ? sp.conversationId : undefined;
  const initialCaseId = typeof sp.caseId === "string" ? sp.caseId : undefined;

  const cases = await prisma.industrialPropertyCase.findMany({
    where: { organizationId },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return (
    <div>
      <PageHeader
        title="Chat com IA"
        description="Assistente especializado em propriedade industrial, com busca na sua base de conhecimento (RAG)."
      />
      <ChatInterface
        cases={cases}
        initialConversationId={initialConversationId}
        initialCaseId={initialCaseId}
      />
    </div>
  );
}
