"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Chunk {
  id: string;
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
}

export function DocumentRowActions({
  documentId,
  status,
}: {
  documentId: string;
  status: string;
}) {
  const router = useRouter();
  const [reprocessing, setReprocessing] = useState(false);
  const [chunksOpen, setChunksOpen] = useState(false);
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const [loadingChunks, setLoadingChunks] = useState(false);

  async function reprocess() {
    setReprocessing(true);
    try {
      await fetch(`/api/documents/${documentId}/process`, { method: "POST" });
      router.refresh();
    } finally {
      setReprocessing(false);
    }
  }

  async function openChunks() {
    setChunksOpen(true);
    setLoadingChunks(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/chunks`);
      const body = await res.json();
      setChunks(body.chunks ?? []);
    } finally {
      setLoadingChunks(false);
    }
  }

  return (
    <>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={openChunks}
          disabled={status !== "READY"}
          title="Visualizar chunks"
        >
          <Eye className="h-4 w-4" />
          Chunks
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={reprocess}
          disabled={reprocessing || status === "PROCESSING"}
          title="Reprocessar documento"
        >
          <RefreshCw className={`h-4 w-4 ${reprocessing ? "animate-spin" : ""}`} />
          Reprocessar
        </Button>
      </div>

      <Dialog open={chunksOpen} onOpenChange={setChunksOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chunks do documento</DialogTitle>
            <DialogDescription>
              Trechos indexados na base vetorial usados pelo RAG.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {loadingChunks && (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            )}
            {!loadingChunks && chunks?.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhum chunk gerado para este documento.
              </p>
            )}
            {!loadingChunks &&
              chunks?.map((chunk) => (
                <div key={chunk.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="secondary">#{chunk.chunkIndex}</Badge>
                    {chunk.pageNumber && (
                      <Badge variant="outline">Página {chunk.pageNumber}</Badge>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {chunk.content}
                  </p>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
