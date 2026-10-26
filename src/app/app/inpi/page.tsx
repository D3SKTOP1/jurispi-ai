import Link from "next/link";
import {
  Award,
  Bell,
  CalendarClock,
  FileSearch,
  Lightbulb,
  Newspaper,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UpdateInpiBaseButton } from "@/components/inpi/sync-buttons";

export const metadata = { title: "Base INPI" };

export default async function InpiHubPage() {
  const { organizationId } = await getAppSession();

  const [trademarks, patents, dispatches, monitored, lastProcessed, latestKnown, lastImport] =
    await Promise.all([
      prisma.inpiTrademark.count(),
      prisma.inpiPatent.count(),
      prisma.rpiDispatch.count(),
      prisma.monitoredProcess.count({ where: { organizationId, isActive: true } }),
      prisma.rpiIssue.findFirst({
        where: { status: "PROCESSED" },
        orderBy: { publishedAt: "desc" },
        select: { number: true, publishedAt: true },
      }),
      prisma.rpiIssue.findFirst({
        orderBy: { publishedAt: "desc" },
        select: { number: true, publishedAt: true, status: true },
      }),
      prisma.inpiImportJob.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      }),
    ]);

  const emptyBase = trademarks === 0 && patents === 0 && dispatches === 0;
  const hasNewerKnown =
    latestKnown && lastProcessed && latestKnown.number !== lastProcessed.number;

  const stats = [
    { label: "Marcas na base", value: trademarks, icon: Award, href: "/app/inpi/trademarks" },
    { label: "Patentes na base", value: patents, icon: Lightbulb, href: "/app/inpi/patents" },
    {
      label: "Publicações da RPI",
      value: dispatches,
      icon: Newspaper,
      href: "/app/inpi/rpi",
    },
    {
      label: "Processos monitorados pelo seu escritório",
      value: monitored,
      icon: Bell,
      href: "/app/inpi/monitoring",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Situação da base + ação principal */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-primary" />
              {lastProcessed ? (
                <>
                  Base atualizada até a{" "}
                  <span className="font-semibold">
                    RPI {lastProcessed.number}, de {formatDate(lastProcessed.publishedAt)}
                  </span>
                  {hasNewerKnown && (
                    <Badge variant="warning">RPI {latestKnown.number} disponível</Badge>
                  )}
                </>
              ) : (
                <span className="font-medium">
                  Nenhuma edição da RPI importada ainda — clique em “Atualizar base do INPI”.
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              A Revista da Propriedade Industrial (RPI) é publicada pelo INPI toda terça-feira.
              {lastImport?.finishedAt
                ? ` Última importação concluída em ${formatDateTime(lastImport.finishedAt)}.`
                : ""}
            </p>
          </div>
          <UpdateInpiBaseButton />
        </CardContent>
      </Card>

      {emptyBase && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm leading-relaxed text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Sua base ainda está vazia</p>
            <p>
              Clique em <span className="font-medium text-foreground">Atualizar base do INPI</span>{" "}
              para importar as edições mais recentes da RPI. Uma única edição de marcas traz
              dezenas de milhares de publicações — a importação leva alguns minutos e o progresso
              aparece ao lado do botão.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-semibold leading-none">
                      {stat.value.toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6 text-sm leading-relaxed text-muted-foreground">
          <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <FileSearch className="h-4 w-4" />
            Como funciona
          </p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>
              A busca vai <span className="font-medium text-foreground">direto ao INPI (ao vivo)</span>{" "}
              — inclusive processos recém-depositados. Cada resultado consultado é guardado
              localmente, então a base de análise de risco{" "}
              <span className="font-medium text-foreground">cresce com o uso</span>, sem depender de
              um espelho nacional.
            </li>
            <li>
              Os processos que seu escritório{" "}
              <Link href="/app/inpi/monitoring" className="font-medium text-foreground underline-offset-2 hover:underline">
                monitora
              </Link>{" "}
              são verificados <span className="font-medium text-foreground">ao vivo no INPI</span>{" "}
              (semanalmente e sob demanda) — publicações novas geram alerta e prazo automático
              (indeferimentos e arquivamentos são críticos).
            </li>
            <li>
              A <span className="font-medium text-foreground">carga em massa da RPI</span> (botão
              acima) é <span className="font-medium text-foreground">opcional</span>: serve para
              pré-popular a base de risco de uma vez. Restrita a administradores; auditável em{" "}
              <Link href="/app/inpi/imports" className="font-medium text-foreground underline-offset-2 hover:underline">
                Importações
              </Link>
              .
            </li>
            <li>
              Para <span className="font-medium text-foreground">emitir e consultar GRU</span>,
              configure a credencial e-INPI do escritório em{" "}
              <Link href="/app/inpi/gru" className="font-medium text-foreground underline-offset-2 hover:underline">
                GRU / e-INPI
              </Link>{" "}
              — ela fica cifrada e é usada só para autenticar no INPI em seu nome.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
