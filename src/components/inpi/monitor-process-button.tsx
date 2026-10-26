"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellPlus, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MonitorProcessButton({
  processNumber,
  type,
  title,
  size = "sm",
}: {
  processNumber: string;
  type: "TRADEMARK" | "PATENT";
  title?: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function monitor() {
    setLoading(true);
    try {
      const res = await fetch("/api/inpi/monitoring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ processNumber, type, title }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Button variant="ghost" size={size} disabled>
        <Check className="h-4 w-4 text-emerald-600" />
        Monitorando
      </Button>
    );
  }

  return (
    <Button variant="outline" size={size} onClick={monitor} disabled={loading}>
      <BellPlus className="h-4 w-4" />
      {loading ? "Salvando…" : "Monitorar"}
    </Button>
  );
}
