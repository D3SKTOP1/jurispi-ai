"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";

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
import { riskLabels } from "@/lib/labels";

const formSchema = z.object({
  brandName: z.string().min(1, "Nome da marca é obrigatório."),
  niceClasses: z.string().optional(),
  presentationType: z.string().optional(),
  nature: z.string().optional(),
  holderName: z.string().optional(),
  applicationDate: z.string().optional(),
  currentStatus: z.string().optional(),
  collisionRisk: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]).optional(),
  clientId: z.string().optional(),
  processNumber: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const NONE = "__none__";

const presentationTypes = ["Nominativa", "Figurativa", "Mista", "Tridimensional", "Posição"];
const natures = ["Produto", "Serviço", "Coletiva", "Certificação"];

export function TrademarkFormDialog({
  clients,
}: {
  clients: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      brandName: "",
      niceClasses: "",
      presentationType: "",
      nature: "",
      holderName: "",
      applicationDate: "",
      currentStatus: "",
      collisionRisk: "UNKNOWN",
      clientId: NONE,
      processNumber: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const res = await fetch("/api/trademarks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...values,
        clientId: values.clientId === NONE ? "" : values.clientId,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Erro ao cadastrar marca.");
      return;
    }

    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Nova marca
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cadastrar marca</DialogTitle>
          <DialogDescription>
            O cadastro cria automaticamente o processo de PI vinculado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brandName">Nome da marca *</Label>
            <Input id="brandName" {...form.register("brandName")} />
            {form.formState.errors.brandName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.brandName.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="niceClasses">Classes Nice (separadas por vírgula)</Label>
              <Input id="niceClasses" placeholder="ex.: 35, 42" {...form.register("niceClasses")} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de apresentação</Label>
              <Select
                value={form.watch("presentationType") || undefined}
                onValueChange={(v) => form.setValue("presentationType", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {presentationTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Natureza</Label>
              <Select
                value={form.watch("nature") || undefined}
                onValueChange={(v) => form.setValue("nature", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {natures.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="holderName">Titular</Label>
              <Input id="holderName" {...form.register("holderName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="processNumber">Nº do processo</Label>
              <Input id="processNumber" {...form.register("processNumber")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="applicationDate">Data de depósito</Label>
              <Input id="applicationDate" type="date" {...form.register("applicationDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentStatus">Status atual</Label>
              <Input
                id="currentStatus"
                placeholder="ex.: Aguardando exame de mérito"
                {...form.register("currentStatus")}
              />
            </div>
            <div className="space-y-2">
              <Label>Risco de colisão</Label>
              <Select
                value={form.watch("collisionRisk")}
                onValueChange={(v) =>
                  form.setValue("collisionRisk", v as FormValues["collisionRisk"])
                }
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
            <Label>Cliente</Label>
            <Select
              value={form.watch("clientId")}
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
