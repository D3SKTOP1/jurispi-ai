import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/utils";
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
import {
  CheckNowButton,
  MonitoringFormDialog,
  MonitoringToggle,
} from "@/components/inpi/monitoring-actions";

export const metadata = { title: "Monitoramento INPI" };

export default async function InpiMonitoringPage() {
  const { organizationId } = await getAppSession();

  const [monitored, clients, cases] = await Promise.all([
    prisma.monitoredProcess.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
        case: { select: { id: true, title: true } },
      },
    }),
    prisma.client.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.industrialPropertyCase.findMany({
      where: { organizationId },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  // Última publicação por processo monitorado — vem dos alertas gerados pelo
  // monitoramento ao vivo (chave dedupe carrega processNumber + rpiNumber).
  const alerts = await prisma.alert.findMany({
    where: {
      organizationId,
      metadata: { path: ["source"], equals: "PEPI_LIVE" },
    },
    orderBy: { createdAt: "desc" },
    select: { title: true, description: true, createdAt: true, metadata: true },
  });
  const lastByProcess = new Map<string, (typeof alerts)[number]>();
  for (const a of alerts) {
    const pn = (a.metadata as { processNumber?: string } | null)?.processNumber;
    if (pn && !lastByProcess.has(pn)) lastByProcess.set(pn, a);
  }
  const normalize = (v: string) => v.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Processos acompanhados pela sua organização. A verificação ao vivo no INPI gera alertas e
          prazos automaticamente (semanal por padrão; use “Verificar agora” para checar na hora).
        </p>
        <div className="flex items-center gap-2">
          <CheckNowButton />
          <MonitoringFormDialog clients={clients} cases={cases} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Processo</TableHead>
                <TableHead>Identificação</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Última publicação</TableHead>
                <TableHead>Último check</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-44" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {monitored.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhum processo monitorado. Adicione um número de processo do INPI para
                    acompanhar publicações da RPI.
                  </TableCell>
                </TableRow>
              )}
              {monitored.map((m) => {
                const last = lastByProcess.get(normalize(m.processNumber));
                const lastMeta = last?.metadata as
                  | { rpiNumber?: string; rpiDate?: string }
                  | null;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="pl-4 font-medium">{m.processNumber}</TableCell>
                    <TableCell className="max-w-52 truncate">
                      {m.title ?? m.case?.title ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.client?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {m.type === "TRADEMARK" ? "Marca" : "Patente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-72">
                      {last ? (
                        <div className="text-xs">
                          {lastMeta?.rpiNumber && (
                            <Badge variant="gold" className="mr-1">
                              RPI {lastMeta.rpiNumber}
                            </Badge>
                          )}
                          <span className="text-muted-foreground">
                            {lastMeta?.rpiDate ? formatDate(new Date(lastMeta.rpiDate)) : ""}{" "}
                            {last.description
                              ? `— ${last.description.replace(/\s+/g, " ").slice(0, 80)}…`
                              : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.lastCheckedAt ? formatDateTime(m.lastCheckedAt) : "nunca"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.isActive ? "success" : "secondary"}>
                        {m.isActive ? "Ativo" : "Pausado"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <MonitoringToggle id={m.id} isActive={m.isActive} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
