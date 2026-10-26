"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Boundary de erro das rotas: mostra recuperação amigável e loga o erro. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div>
        <h1 className="text-lg font-semibold">Algo deu errado</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Ocorreu um erro inesperado ao carregar esta página. Seus dados não foram afetados.
          {error.digest ? ` Código: ${error.digest}.` : ""}
        </p>
      </div>
      <Button onClick={reset} variant="secondary">
        <RotateCcw className="h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  );
}
