"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

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

/**
 * Busca unificada em propriedade industrial (base global importada do INPI).
 * Direciona para a listagem de marcas ou patentes com os filtros aplicados.
 */
export function InpiSearchForm() {
  const router = useRouter();
  const [type, setType] = useState<"trademark" | "patent">("trademark");
  const [query, setQuery] = useState("");
  const [niceClass, setNiceClass] = useState("");
  const [ipc, setIpc] = useState("");
  const [holder, setHolder] = useState("");
  const [status, setStatus] = useState("");
  const [processNumber, setProcessNumber] = useState("");
  // Busca ao vivo no INPI é o padrão.
  const [live, setLive] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (processNumber) params.set("processNumber", processNumber);
    if (status) params.set("status", status);
    // Só precisa marcar quando o usuário DESLIGA o ao vivo (padrão é ligado).
    if (!live) params.set("live", "0");

    if (type === "trademark") {
      if (niceClass) params.set("niceClass", niceClass);
      if (holder) params.set("holder", holder);
      router.push(`/app/inpi/trademarks?${params.toString()}`);
    } else {
      if (ipc) params.set("ipc", ipc);
      if (holder) params.set("applicant", holder);
      router.push(`/app/inpi/patents?${params.toString()}`);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trademark">Marca</SelectItem>
                  <SelectItem value="patent">Patente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="s-query">Termo de busca</Label>
              <Input
                id="s-query"
                placeholder={
                  type === "trademark"
                    ? "Nome da marca (busca por similaridade, sem acentos)"
                    : "Título ou tema da invenção (busca textual)"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {type === "trademark" ? (
              <div className="space-y-2">
                <Label htmlFor="s-nice">Classe Nice</Label>
                <Input
                  id="s-nice"
                  placeholder="ex.: 42"
                  value={niceClass}
                  onChange={(e) => setNiceClass(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="s-ipc">Classificação IPC</Label>
                <Input
                  id="s-ipc"
                  placeholder="ex.: A01G"
                  value={ipc}
                  onChange={(e) => setIpc(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="s-holder">
                {type === "trademark" ? "Titular" : "Depositante"}
              </Label>
              <Input id="s-holder" value={holder} onChange={(e) => setHolder(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-status">Status</Label>
              <Input
                id="s-status"
                placeholder="ex.: vigente"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-process">Número do processo</Label>
              <Input
                id="s-process"
                value={processNumber}
                onChange={(e) => setProcessNumber(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={live}
                onChange={(e) => setLive(e.target.checked)}
              />
              <span>
                <span className="font-medium text-foreground">Buscar direto no INPI</span> (padrão) —
                dados oficiais em tempo real (busca.inpi.gov.br). Desmarque para buscar só na base
                local. Se o INPI estiver fora do ar, cai na base automaticamente.
              </span>
            </label>
            <Button type="submit" className="shrink-0">
              <Search className="h-4 w-4" />
              {live ? "Buscar ao vivo no INPI" : "Buscar na base INPI"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
