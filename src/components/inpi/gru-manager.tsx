"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Barcode,
  Copy,
  Download,
  FilePlus2,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Tipos espelhando a API
// ---------------------------------------------------------------------------

interface Option {
  value: string;
  label: string;
}

interface ServiceConfig {
  temPeticionamento: boolean;
  temApresentacao: boolean;
  temNatureza: boolean;
  temGuiaAnterior: boolean;
  temValor: boolean;
  temObjetoPeticao: boolean;
  temProcesso: boolean;
  temSolicitacao: boolean;
  tituloSolicitacao?: string;
  temRevista: boolean;
  temPeticaoVinculada: boolean;
}

interface ServiceOptions {
  naturezas: Option[];
  apresentacoes: Option[];
  objetosPeticao: Option[];
  peticionamentos: Option[];
}

interface PreviewResult {
  items: { codigoServico: string; nomeServico: string; amountCents: number; amountFormatted: string }[];
  totalCents: number;
  warnings: string[];
}

export interface GruRow {
  id: string;
  gruNumber: string | null;
  serviceCode: string | null;
  processNumber: string | null;
  description: string | null;
  amountCents: number | null;
  status: string;
  barcode: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Falha (${res.status}).`);
  return data as T;
}

function brl(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Aguardando pagamento", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  PAID: { label: "Paga", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  EXPIRED: { label: "Vencida", className: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
  ISSUED: { label: "Emitida", className: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  UNKNOWN: { label: "Situação desconhecida", className: "bg-muted text-muted-foreground" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Assistente de emissão
// ---------------------------------------------------------------------------

interface WizardFields {
  processNumber: string;
  totalDe: string;
  natureza: string;
  apresentacao: string;
  peticionamento: string;
  objetoPeticao: string;
  valorMonetario: string;
  revista: string;
  peticaoVinculada: string;
  guiaAnterior: string;
  description: string;
}

const EMPTY_FIELDS: WizardFields = {
  processNumber: "",
  totalDe: "",
  natureza: "",
  apresentacao: "",
  peticionamento: "",
  objetoPeticao: "",
  valorMonetario: "",
  revista: "",
  peticaoVinculada: "",
  guiaAnterior: "",
  description: "",
};

function GruEmissionWizard({ onIssued }: { onIssued: () => void }) {
  const [types, setTypes] = useState<{ codigo: string; nome: string }[] | null>(null);
  const [diretoria, setDiretoria] = useState("");
  const [services, setServices] = useState<{ codigo: string; nome: string }[] | null>(null);
  const [serviceCode, setServiceCode] = useState("");
  const [detail, setDetail] = useState<{ config: ServiceConfig; options: ServiceOptions } | null>(null);
  const [fields, setFields] = useState<WizardFields>(EMPTY_FIELDS);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [issued, setIssued] = useState<GruRow | null>(null);
  const [busy, setBusy] = useState<null | "types" | "services" | "detail" | "preview" | "emit">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBusy("types");
    api<{ types: { codigo: string; nome: string }[] }>("/api/inpi/gru/catalog")
      .then((d) => !cancelled && setTypes(d.types))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Erro ao consultar o INPI."))
      .finally(() => !cancelled && setBusy(null));
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof WizardFields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setPreview(null);
  }

  async function handleDiretoria(value: string) {
    setDiretoria(value);
    setServiceCode("");
    setServices(null);
    setDetail(null);
    setFields(EMPTY_FIELDS);
    setPreview(null);
    setError(null);
    setBusy("services");
    try {
      const d = await api<{ services: { codigo: string; nome: string }[] }>(
        `/api/inpi/gru/catalog?diretoria=${encodeURIComponent(value)}`
      );
      setServices(d.services);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao consultar o INPI.");
    } finally {
      setBusy(null);
    }
  }

  async function handleService(value: string) {
    setServiceCode(value);
    setDetail(null);
    setFields(EMPTY_FIELDS);
    setPreview(null);
    setError(null);
    setBusy("detail");
    try {
      const d = await api<{ config: ServiceConfig; options: ServiceOptions }>(
        `/api/inpi/gru/catalog?diretoria=${encodeURIComponent(diretoria)}&servico=${encodeURIComponent(value)}`
      );
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao consultar o INPI.");
    } finally {
      setBusy(null);
    }
  }

  function emissionBody() {
    return {
      diretoria,
      serviceCode,
      processNumber: fields.processNumber,
      totalDe: fields.totalDe,
      natureza: fields.natureza,
      apresentacao: fields.apresentacao,
      peticionamento: fields.peticionamento,
      objetoPeticao: fields.objetoPeticao,
      valorMonetario: fields.valorMonetario,
      revista: fields.revista,
      peticaoVinculada: fields.peticaoVinculada,
      guiaAnterior: fields.guiaAnterior,
      description: fields.description,
    };
  }

  async function handlePreview() {
    setError(null);
    setBusy("preview");
    try {
      setPreview(await api<PreviewResult>("/api/inpi/gru/preview", "POST", emissionBody()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no preview.");
    } finally {
      setBusy(null);
    }
  }

  async function handleEmit() {
    if (!preview) return;
    const ok = window.confirm(
      `Emitir GRU de ${brl(preview.totalCents)} no INPI?\n\nA guia é real: só gera custo se o boleto for pago, mas fica registrada na conta e-INPI.`
    );
    if (!ok) return;
    setError(null);
    setBusy("emit");
    try {
      const { gru } = await api<{ gru: GruRow }>("/api/inpi/gru", "POST", emissionBody());
      setIssued(gru);
      onIssued();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao emitir.");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setIssued(null);
    setPreview(null);
    setFields(EMPTY_FIELDS);
    setServiceCode("");
    setDetail(null);
  }

  // Sucesso: mostra número + boleto + código de barras.
  if (issued) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">GRU gerada com sucesso</p>
            <p className="mt-1 font-mono text-lg">{issued.gruNumber}</p>
            <p className="text-sm text-muted-foreground">Valor: {brl(issued.amountCents)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {issued.gruNumber && (
              <Button asChild variant="secondary">
                <a href={`/api/inpi/gru/boleto/${issued.gruNumber}`} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" />
                  Baixar boleto (PDF)
                </a>
              </Button>
            )}
            {issued.barcode && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(issued.barcode ?? "")}
              >
                <Barcode className="h-4 w-4" />
                Copiar código de barras
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={reset}>
              <FilePlus2 className="h-4 w-4" />
              Emitir outra GRU
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const cfg = detail?.config;
  const opts = detail?.options;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <p className="font-medium">Emitir GRU</p>
          <p className="text-sm text-muted-foreground">
            Escolha o serviço da tabela de retribuições do INPI. O valor é calculado no próprio INPI
            antes de emitir — nada é gerado sem sua confirmação.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de serviço (diretoria)</Label>
            <Select value={diretoria} onValueChange={handleDiretoria} disabled={!types || busy !== null}>
              <SelectTrigger>
                <SelectValue placeholder={busy === "types" ? "Consultando o INPI…" : "Selecione"} />
              </SelectTrigger>
              <SelectContent>
                {(types ?? []).map((t) => (
                  <SelectItem key={t.codigo} value={t.codigo}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Serviço</Label>
            <Select
              value={serviceCode}
              onValueChange={handleService}
              disabled={!services || busy !== null}
            >
              <SelectTrigger>
                <SelectValue placeholder={busy === "services" ? "Carregando serviços…" : "Selecione"} />
              </SelectTrigger>
              <SelectContent>
                {(services ?? []).map((s) => (
                  <SelectItem key={s.codigo} value={s.codigo}>
                    {s.codigo} — {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {busy === "detail" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando os campos exigidos pelo serviço…
          </p>
        )}

        {cfg && opts && (
          <div className="grid gap-4 sm:grid-cols-2">
            {cfg.temNatureza && (
              <SelectField
                label="Natureza"
                value={fields.natureza}
                options={opts.naturezas}
                onChange={(v) => set("natureza", v)}
              />
            )}
            {cfg.temApresentacao && (
              <SelectField
                label="Apresentação"
                value={fields.apresentacao}
                options={opts.apresentacoes}
                onChange={(v) => set("apresentacao", v)}
              />
            )}
            {cfg.temPeticionamento && (
              <SelectField
                label="Peticionamento"
                value={fields.peticionamento}
                options={opts.peticionamentos}
                onChange={(v) => set("peticionamento", v)}
              />
            )}
            {cfg.temObjetoPeticao && (
              <SelectField
                label="O objeto da petição se refere a"
                value={fields.objetoPeticao}
                options={opts.objetosPeticao}
                onChange={(v) => set("objetoPeticao", v)}
              />
            )}
            {cfg.temProcesso && (
              <TextField
                label="Processo administrativo"
                value={fields.processNumber}
                onChange={(v) => set("processNumber", v)}
                placeholder="Nº do processo no INPI"
              />
            )}
            {cfg.temSolicitacao && (
              <TextField
                label={`Total de ${cfg.tituloSolicitacao ?? "solicitações"}`}
                value={fields.totalDe}
                onChange={(v) => set("totalDe", v.replace(/\D/g, ""))}
                placeholder="1"
              />
            )}
            {cfg.temValor && (
              <TextField
                label="Valor (R$)"
                value={fields.valorMonetario}
                onChange={(v) => set("valorMonetario", v)}
                placeholder="Ex.: 1225,30"
              />
            )}
            {cfg.temRevista && (
              <TextField
                label="Revista (nº da RPI)"
                value={fields.revista}
                onChange={(v) => set("revista", v)}
                placeholder="Nº da RPI do despacho"
              />
            )}
            {cfg.temPeticaoVinculada && (
              <TextField
                label="Petição vinculada (protocolo)"
                value={fields.peticaoVinculada}
                onChange={(v) => set("peticaoVinculada", v)}
                placeholder="Nº do protocolo da petição"
              />
            )}
            {cfg.temGuiaAnterior && (
              <TextField
                label="Guia anterior (nº da GRU)"
                value={fields.guiaAnterior}
                onChange={(v) => set("guiaAnterior", v.replace(/\D/g, ""))}
                placeholder="Nº da GRU anterior"
              />
            )}
            <TextField
              label="Descrição interna (opcional)"
              value={fields.description}
              onChange={(v) => set("description", v)}
              placeholder="Ex.: cliente Acme — renovação"
            />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {preview && (
          <div className="space-y-2 rounded-md border px-4 py-3">
            <p className="text-sm font-medium">Valor calculado pelo INPI</p>
            {preview.items.map((i) => (
              <p key={i.codigoServico} className="text-sm text-muted-foreground">
                {i.codigoServico} — {i.nomeServico}: <span className="font-medium">{brl(i.amountCents)}</span>
              </p>
            ))}
            <p className="text-base font-semibold">Total: {brl(preview.totalCents)}</p>
            {preview.warnings.map((w) => (
              <p key={w} className="text-xs text-amber-700 dark:text-amber-400">
                {w}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!cfg || busy !== null}
            onClick={handlePreview}
          >
            {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Calcular valor no INPI
          </Button>
          <Button type="button" disabled={!preview || busy !== null} onClick={handleEmit}>
            {busy === "emit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
            {preview ? `Emitir GRU (${brl(preview.totalCents)})` : "Emitir GRU"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista de GRUs
// ---------------------------------------------------------------------------

function GruList({ grus }: { grus: GruRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [consultNumber, setConsultNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(key: string, op: () => Promise<string | null>) {
    setError(null);
    setNotice(null);
    setBusy(key);
    try {
      const msg = await op();
      if (msg) setNotice(msg);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao falar com o INPI.");
    } finally {
      setBusy(null);
    }
  }

  const handleSync = () =>
    run("sync", async () => {
      const d = await api<{ found: number }>("/api/inpi/gru/sync", "POST", { days: 90 });
      return `${d.found} GRU(s) encontradas no INPI nos últimos 90 dias.`;
    });

  const handleConsult = (gruNumber: string) =>
    run(`consult:${gruNumber}`, async () => {
      const d = await api<{ status: { statusText: string } }>("/api/inpi/gru/consult", "POST", { gruNumber });
      return `GRU ${gruNumber}: ${d.status.statusText}.`;
    });

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">GRUs do escritório</p>
            <p className="text-sm text-muted-foreground">
              Guias emitidas por aqui e sincronizadas da conta e-INPI.
            </p>
          </div>
          <Button type="button" variant="secondary" disabled={busy !== null} onClick={handleSync}>
            {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar com o INPI
          </Button>
        </div>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (consultNumber.trim()) void handleConsult(consultNumber.trim());
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="gru-consulta">Consultar GRU por número</Label>
            <Input
              id="gru-consulta"
              className="w-56"
              value={consultNumber}
              inputMode="numeric"
              placeholder="Ex.: 29409172360927772"
              onChange={(e) => setConsultNumber(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={busy !== null || !consultNumber.trim()}>
            <Search className="h-4 w-4" />
            Consultar
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

        {grus.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma GRU registrada ainda. Emita acima ou use “Sincronizar com o INPI”.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRU</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grus.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono text-xs">{g.gruNumber ?? "—"}</TableCell>
                  <TableCell className="max-w-64">
                    <span className="line-clamp-2 text-xs">
                      {g.serviceCode ? `${g.serviceCode}${g.description ? ` — ${g.description}` : ""}` : (g.description ?? "—")}
                    </span>
                    {g.processNumber && (
                      <span className="block text-xs text-muted-foreground">Proc. {g.processNumber}</span>
                    )}
                  </TableCell>
                  <TableCell>{brl(g.amountCents)}</TableCell>
                  <TableCell>
                    <StatusBadge status={g.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(g.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {g.gruNumber && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Atualizar situação no INPI"
                            disabled={busy !== null}
                            onClick={() => handleConsult(g.gruNumber!)}
                          >
                            {busy === `consult:${g.gruNumber}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button asChild variant="ghost" size="sm" title="2ª via do boleto (PDF)">
                            <a href={`/api/inpi/gru/boleto/${g.gruNumber}`} target="_blank" rel="noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </>
                      )}
                      {g.barcode && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title="Copiar código de barras"
                          onClick={() => navigator.clipboard.writeText(g.barcode ?? "")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function GruManager({ grus }: { grus: GruRow[] }) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <GruEmissionWizard onIssued={() => router.refresh()} />
      <GruList grus={grus} />
    </div>
  );
}
