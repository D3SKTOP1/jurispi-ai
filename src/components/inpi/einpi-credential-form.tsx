"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  LogIn,
  ShieldCheck,
  Unplug,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CredentialStatus {
  configured: boolean;
  loginMask: string | null;
  lastVerifiedAt: string | null;
  lastStatus: string | null;
}

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Falha (${res.status}).`);
  return data as T;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "";
  }
}

/**
 * Tela "Conectar conta INPI": o cliente entra com o próprio login e-INPI e
 * o app autentica ao vivo no INPI. Conectado = login validado; a senha
 * fica cifrada e serve só para emitir/consultar GRU em nome do escritório.
 */
export function EinpiCredentialForm({ initial }: { initial: CredentialStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState<null | "connect" | "recheck" | "disconnect">(null);
  const [error, setError] = useState<string | null>(null);

  const connected = status.configured && status.lastStatus === "OK";

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("connect");
    try {
      const next = await api<CredentialStatus>("/api/inpi/gru/credential", "POST", { login, senha });
      setStatus(next);
      setSenha("");
      if (next.lastStatus === "OK") setLogin("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRecheck() {
    setError(null);
    setBusy("recheck");
    try {
      setStatus(await api<CredentialStatus>("/api/inpi/gru/credential/verify", "POST"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao verificar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setBusy("disconnect");
    try {
      await api("/api/inpi/gru/credential", "DELETE");
      setStatus({ configured: false, loginMask: null, lastVerifiedAt: null, lastStatus: null });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desconectar.");
    } finally {
      setBusy(null);
    }
  }

  // Estado CONECTADO: mostra a conta vinculada e ações de manutenção.
  if (connected) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
            <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Conta INPI conectada
              </p>
              <p className="text-sm text-muted-foreground">
                Login <span className="font-medium">{status.loginMask}</span>
                {status.lastVerifiedAt ? ` · validado em ${formatDate(status.lastVerifiedAt)}` : ""}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Sua credencial está guardada cifrada e é usada apenas para autenticar no INPI ao emitir
            ou consultar GRU. Você pode reverificar a qualquer momento ou desconectar.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy !== null} onClick={handleRecheck}>
              {busy === "recheck" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Reverificar login
            </Button>
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={handleDisconnect}>
              {busy === "disconnect" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4" />
              )}
              Desconectar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado DESCONECTADO: formulário de login estilo "Entrar com INPI".
  const rejected = status.lastStatus === "INVALID";
  const unavailable = status.lastStatus === "UNAVAILABLE";

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-semibold">Conectar conta INPI</p>
            <p className="text-sm text-muted-foreground">
              Entre com o login e-INPI do escritório. Autenticamos direto no INPI.
            </p>
          </div>
        </div>

        {rejected && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            Login recusado pelo INPI. Confira usuário e senha e tente novamente.
          </div>
        )}
        {unavailable && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Não foi possível falar com o INPI agora. A credencial foi guardada; tente reverificar
            em instantes.
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="einpi-login">Login e-INPI (CPF/CNPJ ou usuário)</Label>
            <Input
              id="einpi-login"
              autoComplete="off"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="einpi-senha">Senha e-INPI</Label>
            <Input
              id="einpi-senha"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={busy !== null || !login || !senha}>
            {busy === "connect" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Autenticando no INPI…
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Conectar
              </>
            )}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Senha cifrada (AES-256-GCM). Use login/senha e-INPI — não o gov.br.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
