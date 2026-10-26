import { notFound } from "next/navigation";

import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { patentSearchService } from "@/lib/inpi/search/patent-search-service";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MonitorProcessButton } from "@/components/inpi/monitor-process-button";
import { GeneratePatentAnalysisDialog } from "@/components/ai/generate-patent-analysis-dialog";

export const metadata = { title: "Patente INPI" };

export default async function InpiPatentDetailPage({
  params,
}: {
  params: Promise<{ processNumber: string }>;
}) {
  await getAppSession();
  const { processNumber } = await params;

  const patent = await patentSearchService.searchPatentByProcessNumber(processNumber);
  if (!patent) notFound();

  const dispatches = await patentSearchService.getDispatches(patent.processNumber);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{patent.title}</h2>
          <p className="text-sm text-muted-foreground">
            Processo {patent.processNumber} · Fonte: {patent.source} · Última importação:{" "}
            {formatDate(patent.sourceUpdatedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <GeneratePatentAnalysisDialog
            title={patent.title}
            abstract={patent.abstractText ?? undefined}
            ipcClasses={patent.ipcClasses}
            buttonLabel="Gerar análise preliminar"
          />
          <MonitorProcessButton
            processNumber={patent.processNumber}
            type="PATENT"
            title={patent.title}
            size="default"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados bibliográficos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Depositante(s): </span>
              {patent.applicants.join(", ") || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Inventor(es): </span>
              {patent.inventors.join(", ") || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Status: </span>
              {patent.status ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Depósito: </span>
              {formatDate(patent.applicationDate)}
            </p>
            <p>
              <span className="text-muted-foreground">Publicação: </span>
              {formatDate(patent.publicationDate)}
            </p>
            <p>
              <span className="text-muted-foreground">Concessão: </span>
              {formatDate(patent.grantDate)}
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {patent.ipcClasses.map((c) => (
                <Badge key={c} variant="secondary">
                  IPC {c}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {patent.abstractText ?? "Resumo não disponível na base importada."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de despachos</CardTitle>
          <CardDescription>Publicações da RPI vinculadas ao processo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dispatches.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum despacho importado para este processo.
            </p>
          )}
          {dispatches.map((d) => (
            <div key={d.id} className="rounded-md border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {d.rpiNumber && <Badge variant="gold">RPI {d.rpiNumber}</Badge>}
                {d.dispatchCode && <Badge variant="secondary">{d.dispatchCode}</Badge>}
                {d.section && <span>Seção {d.section}</span>}
                <span>{formatDate(d.rpiDate)}</span>
              </div>
              <p className="text-sm">{d.dispatchText}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
