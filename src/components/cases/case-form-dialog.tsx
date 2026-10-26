"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { caseStatusLabels, caseTypeLabels, riskLabels } from "@/lib/labels";

const formSchema = z.object({
  clientId: z.string().optional(),
  type: z.enum(["TRADEMARK", "PATENT", "INDUSTRIAL_DESIGN", "SOFTWARE", "OTHER"]),
  title: z.string().min(1, "Título é obrigatório."),
  processNumber: z.string().optional(),
  status: z.string().optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]).optional(),
  summary: z.string().optional(),
  nextStep: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CaseFormDialogProps {
  clients: Array<{ id: string; name: string }>;
  existingCase?: {
    id: string;
    clientId: string | null;
    type: string;
    title: string;
    processNumber: string | null;
    status: string;
    riskLevel: string;
    summary: string | null;
    nextStep: string | null;
  };
}

const NONE = "__none__";
const CUSTOM = "__custom__";

export function CaseFormDialog({ clients, existingCase }: CaseFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialStatus = existingCase?.status ?? "EM_ANDAMENTO";
  // Se o status salvo não está entre os predefinidos, começa no modo personalizado.
  const [statusCustom, setStatusCustom] = useState(
    !Object.prototype.hasOwnProperty.call(caseStatusLabels, initialStatus),
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: existingCase?.clientId ?? undefined,
      type: (existingCase?.type as FormValues["type"]) ?? "TRADEMARK",
      title: existingCase?.title ?? "",
      processNumber: existingCase?.processNumber ?? "",
      status: existingCase?.status ?? "EM_ANDAMENTO",
      riskLevel: (existingCase?.riskLevel as FormValues["riskLevel"]) ?? "UNKNOWN",
      summary: existingCase?.summary ?? "",
      nextStep: existingCase?.nextStep ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const status = values.status?.trim() || "EM_ANDAMENTO";
    const payload = {
      ...values,
      status,
      clientId: values.clientId === NONE ? "" : values.clientId,
    };

    const res = await fetch(existingCase ? `/api/cases/${existingCase.id}` : "/api/cases", {
      method: existingCase ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Erro ao salvar processo.");
      return;
    }

    setOpen(false);
    if (!existingCase) form.reset();
    router.refresh();
  }

  const typeValue = form.watch("type");
  const riskValue = form.watch("riskLevel");
  const clientValue = form.watch("clientId");
  const statusValue = form.watch("status") ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existingCase ? (
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" />
            Novo processo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{existingCase ? "Editar processo" : "Novo processo"}</DialogTitle>
          <DialogDescription>
            Processo de propriedade industrial acompanhado pela organização.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={typeValue}
                onValueChange={(v) => form.setValue("type", v as FormValues["type"])}
                disabled={Boolean(existingCase)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(caseTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={clientValue ?? NONE}
                onValueChange={(v) => form.setValue("clientId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem cliente</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="processNumber">Nº do processo</Label>
              <Input id="processNumber" placeholder="Ex.: 912345678" {...form.register("processNumber")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={statusCustom ? CUSTOM : statusValue}
                onValueChange={(v) => {
                  if (v === CUSTOM) {
                    setStatusCustom(true);
                    form.setValue("status", "");
                  } else {
                    setStatusCustom(false);
                    form.setValue("status", v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(caseStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM}>Personalizado…</SelectItem>
                </SelectContent>
              </Select>
              {statusCustom && (
                <Input
                  id="status"
                  placeholder="Digite o status"
                  autoFocus
                  {...form.register("status")}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Risco</Label>
              <Select
                value={riskValue ?? "UNKNOWN"}
                onValueChange={(v) => form.setValue("riskLevel", v as FormValues["riskLevel"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(riskLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Resumo</Label>
            <Textarea id="summary" rows={3} {...form.register("summary")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextStep">Próximo passo</Label>
            <Input id="nextStep" {...form.register("nextStep")} />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
