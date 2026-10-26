"use client";

import { useState } from "react";
import { ShieldAlert, Sparkles } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { riskLabels, riskVariants } from "@/lib/labels";

interface RiskResult {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  score: number;
  reasons: string[];
  similarMarks: Array<{
    processNumber: string;
    brandName: string;
    holderName: string | null;
    status: string | null;
    niceClasses: string[];
    similarity?: number;
  }>;
  disclaimer: string;
}

export function TrademarkRiskDialog({
  brandName,
  niceClasses,
  buttonLabel = "Analisar risco com IA",
}: {
  brandName: string;
  niceClasses?: string[];
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState((niceClasses ?? []).join(", "));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RiskResult | null>(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inpi/trademarks/risk-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandName, niceClasses: classes }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Erro na análise de risco.");
        return;
      }
      setResult(body);
    } finally {
      setLoading(false);
    }
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
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Análise preliminar de risco — {brandName}</DialogTitle>
          <DialogDescription>
            Heurística determinística sobre a base pública importada do INPI (busca oficial não
            substituída).
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="risk-classes">Classes Nice (separadas por vírgula)</Label>
              <Input
                id="risk-classes"
                placeholder="ex.: 42"
                value={classes}
                onChange={(e) => setClasses(e.target.value)}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            ) : (
              <Button onClick={analyze} className="w-full">
                Analisar risco
              </Button>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={riskVariants[result.riskLevel]} className="text-sm">
                Risco {riskLabels[result.riskLevel]}
              </Badge>
              <span className="text-sm text-muted-foreground">Score {result.score}/100</span>
            </div>

            <div className="space-y-1.5">
              {result.reasons.map((reason, i) => (
                <p key={i} className="text-sm">
                  • {reason}
                </p>
              ))}
            </div>

            {result.similarMarks.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Marca</th>
                      <th className="p-2 text-left">Processo</th>
                      <th className="p-2 text-left">Classes</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Similaridade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.similarMarks.map((m) => (
                      <tr key={m.processNumber} className="border-t">
                        <td className="p-2 font-medium">{m.brandName}</td>
                        <td className="p-2">{m.processNumber}</td>
                        <td className="p-2">{m.niceClasses.join(", ") || "—"}</td>
                        <td className="p-2">{m.status ?? "—"}</td>
                        <td className="p-2">
                          {m.similarity !== undefined ? `${(m.similarity * 100).toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Alert variant="gold">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>{result.disclaimer}</AlertDescription>
            </Alert>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
