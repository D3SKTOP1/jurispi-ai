"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Sincroniza o caso com o registro oficial do INPI (consulta ao vivo). */
export function EnrichFromInpiButton({
  caseId,
  disabled,
}: {
  caseId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function enrich() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/enrich`, { method: "POST" });
      const data = await res.json().catch(() => null);
      setMsg(data?.message ?? (res.ok ? "Sincronizado." : "Falha ao sincronizar."));
      if (res.ok && data?.enriched) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button
        variant="outline"
        size="sm"
        onClick={enrich}
        disabled={loading || disabled}
        title={disabled ? "Informe o número do processo no INPI para sincronizar." : undefined}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        Sincronizar com INPI
      </Button>
    </div>
  );
}
