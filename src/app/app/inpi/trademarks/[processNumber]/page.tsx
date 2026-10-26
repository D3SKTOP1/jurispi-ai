import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { trademarkSearchService } from "@/lib/inpi/search/trademark-search-service";
import { normalizeProcessNumber } from "@/lib/inpi/normalizers/text-normalizer";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MonitorProcessButton } from "@/components/inpi/monitor-process-button";
import { TrademarkRiskDialog } from "@/components/inpi/trademark-risk-dialog";
import { GenerateTrademarkOpinionDialog } from "@/components/ai/generate-trademark-opinion-dialog";

export const metadata = { title: "Marca INPI" };

export default async function InpiTrademarkDetailPage({
  params,
}: {
  params: Promise<{ processNumber: string }>;
}) {
  const { organizationId } = await getAppSession();
  const { processNumber } = await params;

  const trademark = await trademarkSearchService.searchTrademarkByProcessNumber(processNumber);
  if (!trademark) notFound();

  const [dispatches, applicants, relatedAlerts] = await Promise.all([
    trademarkSearchService.getDispatches(trademark.processNumber),
    prisma.inpiTrademarkApplicant.findMany({
      where: { trademark: { processNumber: normalizeProcessNumber(processNumber) } },
    }),
    prisma.alert.findMany({
      where: {
        organizationId,
        metadata: { path: ["processNumber"], equals: trademark.processNumber },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{trademark.brandName}</h2>
          <p className="text-sm text-muted-foreground">
            Processo {trademark.processNumber} · Fonte: {trademark.source} · Última importação:{" "}
            {formatDate(trademark.sourceUpdatedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <TrademarkRiskDialog
            brandName={trademark.brandName}
            niceClasses={trademark.niceClasses}
          />
          <GenerateTrademarkOpinionDialog
            brandName={trademark.brandName}
            niceClasses={trademark.niceClasses}
            buttonLabel="Gerar parecer preliminar"
          />
          <MonitorProcessButton
            processNumber={trademark.processNumber}
            type="TRADEMARK"
            title={trademark.brandName}
            size="default"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados principais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Titular: </span>
              {trademark.holderName ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Apresentação: </span>
              {trademark.presentation ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Natureza: </span>
              {trademark.nature ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Status: </span>
              {trademark.status ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Depósito: </span>
              {formatDate(trademark.applicationDate)}
            </p>
            <p>
              <span className="text-muted-foreground">Registro: </span>
              {formatDate(trademark.registrationDate)}
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {trademark.niceClasses.map((c) => (
                <Badge key={c} variant="secondary">
                  Nice {c}
                </Badge>
              ))}
            </div>
            {applicants.length > 0 && (
              <div className="border-t pt-2">
                <p className="text-muted-foreground">Requerentes:</p>
                {applicants.map((a) => (
                  <p key={a.id}>
                    {a.name}
                    {a.document ? ` (${a.document})` : ""}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Histórico de despachos</CardTitle>
            <CardDescription>Publicações da RPI e dados abertos vinculados ao processo.</CardDescription>
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

            {relatedAlerts.length > 0 && (
              <div className="border-t pt-3">
                <p className="mb-2 text-sm font-medium">Alertas da sua organização</p>
                {relatedAlerts.map((a) => (
                  <p key={a.id} className="text-sm text-muted-foreground">
                    • {a.title}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
