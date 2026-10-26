"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Troca a organização ativa (aparece só quando o usuário tem mais de uma). */
export function OrgSwitcher({
  organizations,
  activeId,
}: {
  organizations: Array<{ id: string; name: string }>;
  activeId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (organizations.length < 2) return null;

  async function switchOrg(organizationId: string) {
    if (organizationId === activeId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Building2 className="h-4 w-4 text-muted-foreground" />
      )}
      <Select value={activeId} onValueChange={switchOrg} disabled={loading}>
        <SelectTrigger className="h-8 w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
