"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Loader2, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

interface Holder {
  pos: number;
  name: string;
}
interface Row {
  processNumber: string;
  type: "TRADEMARK" | "PATENT";
  title: string;
  niceClasses?: string[];
  holderName?: string | null;
}
interface Report {
  imported: number;
  existed: number;
  failed: number;
  errors: string[];
}

const key = (r: Row) => `${r.type}:${r.processNumber}`;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Falha (${res.status}).`);
  return data as T;
}

export function PortfolioImport({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [activeHolder, setActiveHolder] = useState<number | null>(null);
  const [holderMarks, setHolderMarks] = useState<Row[]>([]);
  const [loadingHolder, setLoadingHolder] = useState(false);
  const [patents, setPatents] = useState<Row[]>([]);

  const [selected, setSelected] = useState<Map<string, Row>>(new Map());
  const [clientId, setClientId] = useState("__none__");
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  function toggle(row: Row) {
    setSelected((prev) => {
      const next = new Map(prev);
      const k = key(row);
      if (next.has(k)) next.delete(k);
      else next.set(k, row);
      return next;
    });
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    setHolders(null);
    setHolderMarks([]);
    setActiveHolder(null);
    setPatents([]);
    setSelected(new Map());
    setReport(null);
    try {
      const data = await post<{ holders: Holder[]; patents: Row[] }>("/api/inpi/import/search", {
        query,
      });
      setHolders(data.holders);
      setPatents(
        data.patents.map((p) => ({
          processNumber: (p as unknown as { processNumber: string }).processNumber,
          type: "PATENT" as const,
          title: (p as unknown as { title: string }).title,
          holderName: (p as unknown as { applicants?: string[] }).applicants?.[0] ?? null,
        }))
      );
      // Se só há um titular, já expande.
      if (data.holders.length === 1) await loadHolder(data.holders[0].pos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na busca.");
    } finally {
      setSearching(false);
    }
  }

  async function loadHolder(pos: number) {
    setLoadingHolder(true);
    setActiveHolder(pos);
    try {
      const data = await post<{ trademarks: Array<Record<string, unknown>> }>(
        "/api/inpi/import/holder-trademarks",
        { query, pos }
      );
      setHolderMarks(
        data.trademarks.map((t) => ({
          processNumber: t.processNumber as string,
          type: "TRADEMARK" as const,
          title: t.brandName as string,
          niceClasses: (t.niceClasses as string[]) ?? [],
          holderName: (t.holderName as string) ?? null,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir titular.");
    } finally {
      setLoadingHolder(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const data = await post<Report>("/api/inpi/import", {
        clientId: clientId === "__none__" ? "" : clientId,
        items: [...selected.values()],
      });
      setReport(data);
      setSelected(new Map());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na importação.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="imp-q">CNPJ, CPF ou nome do titular</Label>
              <Input
                id="imp-q"
                placeholder="ex.: 12.345.678/0001-90 ou WELEDA"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={searching || query.trim().length < 3}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar no INPI
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="text-sm">
              <p className="font-medium">Importação concluída</p>
              <p className="text-muted-foreground">
                {report.imported} importado(s) · {report.existed} já existiam · {report.failed}{" "}
                falha(s). Os processos entraram como casos e já estão em monitoramento; use
                “Sincronizar com INPI” em cada um (ou aguarde o monitoramento) para completar os
                dados.
              </p>
              {report.errors.length > 0 && (
                <p className="mt-1 text-xs text-destructive">{report.errors.join(" · ")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {holders && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Titulares → marcas */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" /> Titulares encontrados ({holders.length})
              </p>
              {holders.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum titular de marca encontrado.</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {holders.map((h) => (
                  <button
                    key={h.pos}
                    onClick={() => loadHolder(h.pos)}
                    className={`rounded-md border px-2.5 py-1 text-left text-xs transition-colors ${
                      activeHolder === h.pos
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {h.name}
                  </button>
                ))}
              </div>

              {loadingHolder && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando marcas…
                </p>
              )}
              {!loadingHolder && activeHolder !== null && (
                <SelectableList
                  rows={holderMarks}
                  selected={selected}
                  onToggle={toggle}
                  empty="Nenhuma marca para este titular."
                />
              )}
            </CardContent>
          </Card>

          {/* Patentes por depositante */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-medium">Patentes por depositante ({patents.length})</p>
              <SelectableList
                rows={patents}
                selected={selected}
                onToggle={toggle}
                empty="Nenhuma patente encontrada para este depositante."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {selected.size > 0 && (
        <Card className="sticky bottom-4 border-primary/40">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{selected.size} selecionado(s)</Badge>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-9 w-56">
                  <SelectValue placeholder="Vincular a cliente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem cliente</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Importar selecionados
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SelectableList({
  rows,
  selected,
  onToggle,
  empty,
}: {
  rows: Row[];
  selected: Map<string, Row>;
  onToggle: (r: Row) => void;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="max-h-80 space-y-1 overflow-y-auto">
      {rows.map((r) => {
        const k = `${r.type}:${r.processNumber}`;
        const checked = selected.has(k);
        return (
          <li key={k}>
            <label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-muted">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={checked}
                onChange={() => onToggle(r)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.title || r.processNumber}</span>
                <span className="block text-xs text-muted-foreground">
                  {r.processNumber}
                  {r.niceClasses && r.niceClasses.length > 0 ? ` · Nice ${r.niceClasses.join(", ")}` : ""}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
