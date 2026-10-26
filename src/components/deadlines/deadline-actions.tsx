"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DeadlineActions({ deadlineId, status }: { deadlineId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markDone() {
    setLoading(true);
    try {
      await fetch(`/api/deadlines/${deadlineId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (status === "DONE") return null;

  return (
    <Button variant="ghost" size="sm" disabled={loading} onClick={markDone}>
      <Check className="h-4 w-4" />
      Concluir
    </Button>
  );
}
