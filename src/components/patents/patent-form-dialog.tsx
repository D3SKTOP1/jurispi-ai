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
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  title: z.string().min(1, "Título é obrigatório."),
  abstract: z.string().optional(),
  ipcClasses: z.string().optional(),
  inventors: z.string().optional(),
  applicants: z.string().optional(),
  filingDate: z.string().optional(),
  publicationDate: z.string().optional(),
  grantDate: z.string().optional(),
  expirationDate: z.string().optional(),
  currentStatus: z.string().optional(),
  processNumber: z.string().optional(),
  clientId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const NONE = "__none__";

export function PatentFormDialog({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      abstract: "",
      ipcClasses: "",
      inventors: "",
      applicants: "",
      filingDate: "",
      publicationDate: "",
      grantDate: "",
      expirationDate: "",
      currentStatus: "",
      processNumber: "",
      clientId: NONE,
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const res = await fetch("/api/patents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...values,
        clientId: values.clientId === NONE ? "" : values.clientId,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Erro ao cadastrar patente.");
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
          Nova patente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cadastrar patente</DialogTitle>
          <DialogDescription>
            O cadastro cria automaticamente o processo de PI vinculado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pt-title">Título *</Label>
            <Input id="pt-title" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pt-abstract">Resumo</Label>
            <Textarea id="pt-abstract" rows={3} {...form.register("abstract")} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pt-ipc">Classificação IPC (vírgula)</Label>
              <Input id="pt-ipc" placeholder="ex.: A01G 25/16" {...form.register("ipcClasses")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-processNumber">Nº do processo</Label>
              <Input id="pt-processNumber" placeholder="ex.: BR102024..." {...form.register("processNumber")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-inventors">Inventores (vírgula)</Label>
              <Input id="pt-inventors" {...form.register("inventors")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-applicants">Depositantes (vírgula)</Label>
              <Input id="pt-applicants" {...form.register("applicants")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-filingDate">Data de depósito</Label>
              <Input id="pt-filingDate" type="date" {...form.register("filingDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-publicationDate">Data de publicação</Label>
              <Input id="pt-publicationDate" type="date" {...form.register("publicationDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-grantDate">Data de concessão</Label>
              <Input id="pt-grantDate" type="date" {...form.register("grantDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-expirationDate">Data de expiração</Label>
              <Input id="pt-expirationDate" type="date" {...form.register("expirationDate")} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pt-currentStatus">Status atual</Label>
              <Input
                id="pt-currentStatus"
                placeholder="ex.: Aguardando exame técnico"
                {...form.register("currentStatus")}
              />
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
