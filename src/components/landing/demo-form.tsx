"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";

/**
 * Formulário "Solicitar demonstração" da landing pública.
 * Grava o lead em /api/leads; sem login.
 */
export function DemoForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", firmName: "", message: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, consent }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Falha (${res.status}).`);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-[hsl(41,55%,52%)]/40 bg-[hsl(41,55%,52%)]/10 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[hsl(41,55%,52%)]" />
        <p className="mt-3 text-lg font-semibold text-white">Pedido recebido!</p>
        <p className="mt-1 text-sm text-slate-300">
          Em breve a equipe entra em contato para agendar sua demonstração guiada.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-[hsl(41,55%,52%)] focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Seu nome*"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
          maxLength={120}
        />
        <input
          className={inputClass}
          type="email"
          placeholder="E-mail profissional*"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          required
          maxLength={200}
        />
        <input
          className={inputClass}
          placeholder="WhatsApp (opcional)"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          maxLength={30}
        />
        <input
          className={inputClass}
          placeholder="Escritório / agência (opcional)"
          value={form.firmName}
          onChange={(e) => set("firmName", e.target.value)}
          maxLength={160}
        />
      </div>
      <textarea
        className={inputClass}
        rows={2}
        placeholder="Conte rapidamente sua rotina com o INPI (opcional)"
        value={form.message}
        onChange={(e) => set("message", e.target.value)}
        maxLength={1000}
      />

      <label className="flex items-start gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          className="mt-0.5 accent-[hsl(41,55%,52%)]"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        <span>
          Ao solicitar, você concorda com nossa{" "}
          <Link href="/privacidade" className="underline hover:text-slate-200" target="_blank">
            Política de Privacidade
          </Link>{" "}
          e com o tratamento dos seus dados conforme a LGPD.
        </span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={busy || !consent}
        className="lp-btn flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(41,55%,52%)] px-6 py-3 text-sm font-semibold text-[hsl(41,60%,12%)] hover:bg-[hsl(41,60%,58%)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Solicitar demonstração
      </button>
      <p className="text-center text-xs text-slate-400">
        Sem cartão de crédito • Demonstração guiada com a equipe
      </p>
    </form>
  );
}
