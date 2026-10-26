"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AlertActions({ alertId, status }: { alertId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function update(newStatus: "RESOLVED" | "DISMISSED") {
    setLoading(true);
    try {
      await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (status !== "OPEN") return null;

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={loading}
        onClick={() => update("RESOLVED")}
        title="Marcar como resolvido"
      >
        <Check className="h-4 w-4" />
        Resolver
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={loading}
        onClick={() => update("DISMISSED")}
        title="Descartar alerta"
      >
        <X className="h-4 w-4" />
        Descartar
      </Button>
    </div>
  );
}
