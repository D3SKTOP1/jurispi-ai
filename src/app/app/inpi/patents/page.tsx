import Link from "next/link";

import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { liveInpiSearchService } from "@/lib/inpi/search/live-search-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonitorProcessButton } from "@/components/inpi/monitor-process-button";
import { GeneratePatentAnalysisDialog } from "@/components/ai/generate-patent-analysis-dialog";
import { SearchOriginNotice } from "@/components/inpi/search-origin-notice";

export const metadata = { title: "Patentes INPI" };

// Busca de patentes ao vivo no INPI pode ser lenta (pePI). Amplia o limite
// de duração onde o provedor serverless permitir; caso contrário, o fallback
// para a base local assume.
export const maxDuration = 60;

export default async function InpiPatentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await getAppSession();
  const sp = await searchParams;
  const str = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : undefined);

  const query = str("q");
  const applicant = str("applicant");
  const inventor = str("inventor");
  const processNumber = str("processNumber");
  // Busca direto no INPI por padrão; base local só sem critério ou no fallback.
  const hasCriteria = Boolean(query || processNumber || applicant || inventor);
  const live = hasCriteria && str("live") !== "0";
  const { results, origin, degraded, notice } = await liveInpiSearchService.searchPatents(
    {
      query,
      ipc: str("ipc"),
      applicant,
      inventor,
      processNumber,
      status: str("status"),
      limit: 50,
    },
    { live }
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {query ? (
            <>
              Resultados para <span className="font-medium text-foreground">“{query}”</span> —{" "}
              {results.length} patente(s)
            </>
          ) : (
            <>
              {results.length} patente(s){" "}
              {origin === "live" ? "encontradas ao vivo no INPI" : "na base importada"}
            </>
          )}
        </p>
        <Link href="/app/inpi/search" className="text-sm text-primary hover:underline">
          Refinar busca →
        </Link>
      </div>

      <SearchOriginNotice origin={origin} degraded={degraded} notice={notice} live={live} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Título</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Depositante</TableHead>
                <TableHead>Inventores</TableHead>
                <TableHead>IPC</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Depósito</TableHead>
                <TableHead className="w-72" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhuma patente encontrada. Use “Atualizar base do INPI” na Visão geral ou
                    ajuste os filtros.
                  </TableCell>
                </TableRow>
              )}
              {results.map((pt) => (
                <TableRow key={pt.id}>
                  <TableCell className="max-w-72 pl-4 font-medium">
                    <Link
                      href={`/app/inpi/patents/${pt.processNumber}`}
                      className="hover:underline"
                    >
                      {pt.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{pt.processNumber}</TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">
                    {pt.applicants.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">
                    {pt.inventors.join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {pt.ipcClasses.map((c) => (
                        <Badge key={c} variant="secondary">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{pt.status ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(pt.applicationDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <GeneratePatentAnalysisDialog
                        title={pt.title}
                        abstract={pt.abstractText ?? undefined}
                        ipcClasses={pt.ipcClasses}
                        buttonLabel="Analisar"
                      />
                      <MonitorProcessButton
                        processNumber={pt.processNumber}
                        type="PATENT"
                        title={pt.title}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
