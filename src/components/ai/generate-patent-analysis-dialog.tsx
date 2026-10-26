"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileOutput, Sparkles } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  caseId?: string;
  title: string;
  abstract?: string;
  ipcClasses: string[];
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "ghost";
  buttonSize?: "default" | "sm";
}

interface GenerationResult {
  generatedDocumentId: string;
  title: string;
  content: string;
  citations: Array<{ sourceTitle: string; quote: string }>;
}

export function GeneratePatentAnalysisDialog({
  caseId,
  title,
  abstract,
  ipcClasses,
  buttonLabel = "Gerar análise com IA",
  buttonVariant = "outline",
  buttonSize = "sm",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [priorArt, setPriorArt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate/patent-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId,
          title,
          abstract,
          keywords,
          ipcClasses,
          priorArt,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Erro ao gerar análise.");
        return;
      }
      setResult(body);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize}>
          <Sparkles className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Análise preliminar de patente</DialogTitle>
          <DialogDescription>
            Análise técnica assistiva gerada por IA. Não substitui busca de anterioridade formal
            nem o exame do INPI.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keywords">Palavras-chave (separadas por vírgula)</Label>
              <Input
                id="keywords"
                placeholder="ex.: sensor, irrigação, IoT"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priorArt">Possíveis anterioridades conhecidas</Label>
              <Textarea
                id="priorArt"
                rows={3}
                placeholder="Documentos, patentes ou produtos similares já identificados."
                value={priorArt}
                onChange={(e) => setPriorArt(e.target.value)}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? "Gerando análise…" : "Gerar análise"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm">
              {result.content}
            </div>
            {result.citations.length > 0 && (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  Fontes internas utilizadas
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {result.citations.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium text-foreground">[Fonte {i + 1}]</span>{" "}
                      {c.sourceTitle}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
                {copied ? "Copiado!" : "Copiar"}
              </Button>
              <Button asChild>
                <Link href={`/app/generated-documents/${result.generatedDocumentId}`}>
                  <FileOutput className="h-4 w-4" />
                  Abrir documento gerado
                </Link>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
