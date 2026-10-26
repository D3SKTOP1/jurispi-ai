import { Radio, Database, AlertTriangle } from "lucide-react";

import type { LiveSearchOrigin } from "@/lib/inpi/search/live-search-service";

/**
 * Faixa que informa a origem dos resultados: consulta ao vivo no INPI
 * (pePI) ou base local importada. Sinaliza fallback quando o modo ao vivo
 * foi pedido mas o INPI estava indisponível.
 */
export function SearchOriginNotice({
  origin,
  degraded,
  notice,
  live,
}: {
  origin: LiveSearchOrigin;
  degraded: boolean;
  notice?: string;
  live: boolean;
}) {
  if (degraded) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{notice ?? "Consulta ao vivo indisponível; exibindo a base importada."}</span>
      </div>
    );
  }

  if (origin === "live") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
        <Radio className="h-4 w-4 shrink-0" />
        <span>
          Consulta <strong>ao vivo no INPI</strong> (busca.inpi.gov.br). Dados oficiais no momento
          da consulta.
        </span>
      </div>
    );
  }

  if (!live) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <Database className="h-4 w-4 shrink-0" />
      <span>Resultados da base importada (Dados Abertos INPI + RPI).</span>
    </div>
  );
}
