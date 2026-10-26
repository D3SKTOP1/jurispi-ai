"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, History, Loader2, MessageSquarePlus, Send, ShieldAlert, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const NONE = "__none__";

interface CitationDto {
  id?: string;
  documentId: string | null;
  chunkId: string | null;
  sourceTitle: string;
  quote: string;
  pageNumber: number | null;
}

interface MessageDto {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  citations?: CitationDto[];
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  case: { id: string; title: string } | null;
  _count: { messages: number };
}

export function ChatInterface({
  cases,
  initialConversationId,
  initialCaseId,
}: {
  cases: Array<{ id: string; title: string }>;
  initialConversationId?: string;
  initialCaseId?: string;
}) {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null
  );
  const [caseId, setCaseId] = useState<string>(initialCaseId ?? NONE);
  const [input, setInput] = useState("");
  const [pendingMessages, setPendingMessages] = useState<MessageDto[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const res = await fetch("/api/ai/conversations");
      const body = await res.json();
      return body.conversations ?? [];
    },
  });

  const conversationQuery = useQuery({
    queryKey: ["conversation", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const res = await fetch(`/api/ai/conversations/${conversationId}`);
      const body = await res.json();
      return body.conversation as {
        id: string;
        title: string;
        case: { id: string; title: string } | null;
        messages: MessageDto[];
      };
    },
  });

  const messages: MessageDto[] = [
    ...(conversationQuery.data?.messages ?? []),
    ...pendingMessages,
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  function startNewConversation() {
    setConversationId(null);
    setPendingMessages([]);
    setError(null);
  }

  async function handleSend() {
    const message = input.trim();
    if (!message || sending) return;

    setSending(true);
    setError(null);
    setInput("");
    setPendingMessages((prev) => [
      ...prev,
      { id: `pending-${Date.now()}`, role: "USER", content: message },
    ]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId ?? "",
          caseId: caseId === NONE ? "" : caseId,
          message,
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error ?? "Erro ao enviar mensagem.");
        return;
      }

      setConversationId(body.conversationId);
      setPendingMessages([]);
      await queryClient.invalidateQueries({ queryKey: ["conversation", body.conversationId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } finally {
      setSending(false);
    }
  }

  const activeCase = conversationQuery.data?.case;

  function selectConversation(id: string) {
    setConversationId(id);
    setPendingMessages([]);
    setError(null);
    setHistoryOpen(false);
  }

  const conversationList = (
    <>
      <div className="border-b p-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            startNewConversation();
            setHistoryOpen(false);
          }}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Nova conversa
        </Button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {conversationsQuery.isLoading && (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        )}
        {conversationsQuery.data?.length === 0 && (
          <p className="p-3 text-center text-xs text-muted-foreground">
            Nenhuma conversa ainda.
          </p>
        )}
        {conversationsQuery.data?.map((conv) => (
          <button
            key={conv.id}
            onClick={() => selectConversation(conv.id)}
            className={cn(
              "w-full rounded-md p-2.5 text-left transition-colors hover:bg-accent",
              conversationId === conv.id && "bg-accent"
            )}
          >
            <p className="truncate text-sm font-medium">{conv.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {conv.case ? `Processo: ${conv.case.title}` : "Conversa geral"} ·{" "}
              {conv._count.messages} msgs
            </p>
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] gap-4 lg:h-[calc(100vh-8.5rem)]">
      {/* Histórico lateral (desktop) */}
      <aside className="hidden w-72 shrink-0 flex-col rounded-lg border bg-card md:flex">
        {conversationList}
      </aside>

      {/* Histórico (mobile) */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="flex w-80 flex-col p-0 pt-10">
          <SheetTitle className="sr-only">Histórico de conversas</SheetTitle>
          {conversationList}
        </SheetContent>
      </Sheet>

      {/* Área do chat */}
      <div className="flex min-w-0 flex-1 flex-col rounded-lg border bg-card">
        {/* Contexto */}
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setHistoryOpen(true)}
            aria-label="Histórico de conversas"
          >
            <History className="h-4 w-4" />
          </Button>
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Assistente JurisPI</span>
          {conversationId ? (
            activeCase ? (
              <Badge variant="gold">Contexto: {activeCase.title}</Badge>
            ) : (
              <Badge variant="secondary">Conversa geral</Badge>
            )
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Contexto:</span>
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger className="h-8 w-64">
                  <SelectValue placeholder="Toda a organização" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Toda a organização</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Mensagens */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && !sending && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <Bot className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Como posso ajudar?</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Pergunte sobre marcas, patentes, despachos do INPI ou documentos da sua base de
                conhecimento. As respostas citam as fontes internas utilizadas.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.role === "USER" && "flex-row-reverse")}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  msg.role === "USER"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {msg.role === "USER" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              <div
                className={cn(
                  "max-w-[80%] space-y-2 rounded-lg p-3 text-sm",
                  msg.role === "USER"
                    ? "bg-primary text-primary-foreground"
                    : "border bg-background"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="border-t pt-2">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      Fontes citadas
                    </p>
                    <ul className="space-y-1.5">
                      {msg.citations.map((c, i) => (
                        <li key={c.id ?? i} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">[Fonte {i + 1}]</span>{" "}
                          {c.sourceTitle}
                          {c.pageNumber ? `, p. ${c.pageNumber}` : ""}
                          <span className="mt-0.5 block italic">&ldquo;{c.quote}&rdquo;</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Consultando a base de conhecimento…
              </div>
            </div>
          )}

          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Textarea
              placeholder="Digite sua pergunta sobre propriedade industrial…"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="resize-none"
            />
            <Button onClick={handleSend} disabled={sending || !input.trim()} className="h-auto">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" />
            Análise assistiva. Não substitui consulta profissional ou oficial.
          </p>
        </div>
      </div>
    </div>
  );
}
