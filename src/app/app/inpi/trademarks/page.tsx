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
import { TrademarkRiskDialog } from "@/components/inpi/trademark-risk-dialog";
import { SearchOriginNotice } from "@/components/inpi/search-origin-notice";

export const metadata = { title: "Marcas INPI" };

// Consulta ao vivo no pePI; margem extra de duração para o provedor serverless.
export const maxDuration = 60;

export default async function InpiTrademarksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await getAppSession();
  const sp = await searchParams;
  const str = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : undefined);

  const query = str("q");
  const holder = str("holder");
  const processNumber = str("processNumber");
  // Busca vai DIRETO ao INPI por padrão (ao vivo). Só cai para a base local
  // quando não há critério de busca (navegação livre) ou o usuário desliga
  // com live=0. O fallback à base local é automático se o INPI estiver fora.
  const hasCriteria = Boolean(query || processNumber || holder);
  const live = hasCriteria && str("live") !== "0";
  const mode = str("mode") === "exact" ? "exact" : undefined;
  const { results, origin, degraded, notice } = await liveInpiSearchService.searchTrademarks(
    {
      query,
      niceClass: str("niceClass"),
      holder,
      processNumber,
      status: str("status"),
      mode,
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
              {results.length} marca(s)
            </>
          ) : (
            <>
              {results.length} marca(s){" "}
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
                <TableHead className="pl-4">Marca</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Depósito</TableHead>
                <TableHead>Similaridade</TableHead>
                <TableHead className="w-72" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhuma marca encontrada. Use “Atualizar base do INPI” na Visão geral ou
                    ajuste os filtros.
                  </TableCell>
                </TableRow>
              )}
              {results.map((tm) => (
                <TableRow key={tm.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link
                      href={`/app/inpi/trademarks/${tm.processNumber}`}
                      className="hover:underline"
                    >
                      {tm.brandName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tm.processNumber}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {tm.holderName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tm.niceClasses.map((c) => (
                        <Badge key={c} variant="secondary">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tm.status ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(tm.applicationDate)}
                  </TableCell>
                  <TableCell>
                    {tm.similarity !== undefined ? (
                      <Badge variant={tm.similarity >= 0.65 ? "warning" : "secondary"}>
                        {(tm.similarity * 100).toFixed(0)}%
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <TrademarkRiskDialog
                        brandName={tm.brandName}
                        niceClasses={tm.niceClasses}
                        buttonLabel="Analisar risco"
                      />
                      <MonitorProcessButton
                        processNumber={tm.processNumber}
                        type="TRADEMARK"
                        title={tm.brandName}
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
