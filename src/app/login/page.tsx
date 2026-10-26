"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Scale, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState("login");
  // Cadastro público só quando explicitamente habilitado (fechado por padrão).
  const signupEnabled = process.env.NEXT_PUBLIC_SIGNUP === "true";

  // Entrar
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Criar conta teste
  const [regName, setRegName] = useState("");
  const [regOrg, setRegOrg] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  async function doSignIn(signInEmail: string, signInPassword: string): Promise<boolean> {
    const result = await signIn("credentials", {
      email: signInEmail,
      password: signInPassword,
      redirect: false,
    });
    if (result?.error) return false;
    router.push("/app/dashboard");
    router.refresh();
    return true;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const ok = await doSignIn(email, password);
      if (!ok) setError("Credenciais inválidas. Verifique e-mail e senha.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          organizationName: regOrg,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setRegError(
          body?.issues?.[0]?.message ?? body?.error ?? "Não foi possível criar a conta."
        );
        return;
      }
      // Conta criada: entra automaticamente.
      const ok = await doSignIn(regEmail, regPassword);
      if (!ok) {
        setTab("login");
        setEmail(regEmail);
        setError("Conta criada! Entre com sua senha.");
      }
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gradient-to-br from-[hsl(220,45%,10%)] via-[hsl(219,50%,14%)] to-[hsl(219,55%,20%)] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 ring-1 ring-gold/50">
            <Scale className="h-7 w-7 text-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">JurisPI AI</h1>
            <p className="text-sm text-white/60">
              Inteligência artificial para propriedade industrial
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            {signupEnabled ? (
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="login" className="flex-1">
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger value="register" className="flex-1">
                    Criar conta
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : (
              <CardTitle className="text-base">Entrar</CardTitle>
            )}
          </CardHeader>
          <CardContent>
            {tab === "login" || !signupEnabled ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@escritorio.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <Alert variant="info">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
                <p className="text-center text-sm">
                  <a href="/esqueci-senha" className="text-muted-foreground hover:text-primary hover:underline">
                    Esqueceu a senha?
                  </a>
                </p>
              </form>
            ) : (
              <div className="space-y-4">
                <CardTitle className="text-base">Experimente gratuitamente</CardTitle>
                <CardDescription>
                  Sua conta de teste cria um espaço de trabalho próprio, já com a base pública
                  do INPI carregada para buscas e análises de IA.
                </CardDescription>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Seu nome</Label>
                    <Input
                      id="reg-name"
                      autoComplete="name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-org">Escritório / empresa</Label>
                    <Input
                      id="reg-org"
                      placeholder="ex.: Silva & Associados PI"
                      value={regOrg}
                      onChange={(e) => setRegOrg(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">E-mail</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Senha (mínimo 8 caracteres)</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </div>

                  {regError && (
                    <Alert variant="destructive">
                      <AlertDescription>{regError}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={regLoading}>
                    {regLoading ? "Criando conta…" : "Criar conta"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Ao criar a conta, você concorda com os{" "}
                    <a href="/termos" className="underline-offset-2 underline hover:text-primary">
                      Termos de Uso
                    </a>{" "}
                    e a{" "}
                    <a href="/privacidade" className="underline-offset-2 underline hover:text-primary">
                      Política de Privacidade
                    </a>
                    .
                  </p>
                </form>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="flex items-center justify-center gap-2 text-center text-xs text-white/50">
          <ShieldCheck className="h-4 w-4" />
          Análise assistiva. Não substitui consulta profissional ou oficial ao INPI.
        </p>
        <p className="text-center text-xs text-white/40">
          <a href="/termos" className="underline-offset-2 hover:text-white/70 hover:underline">
            Termos de Uso
          </a>
          {" · "}
          <a href="/privacidade" className="underline-offset-2 hover:text-white/70 hover:underline">
            Política de Privacidade
          </a>
        </p>
      </div>
    </div>
  );
}
