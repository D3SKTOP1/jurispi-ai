import { Award, Bell, CalendarClock, LayoutDashboard, Lightbulb, Scale, Search } from "lucide-react";

const GOLD = "text-[hsl(41,55%,55%)]";

/**
 * Mockup ilustrativo da plataforma (JSX puro — sem screenshot), no estilo
 * visual real do app: sidebar navy, cards de resumo e monitoramento com
 * prazos. Dados fictícios, marcados como ilustração.
 */
export function AppMockup() {
  return (
    <div className="relative mx-auto mt-14 max-w-4xl" aria-hidden="true">
      {/* brilho atrás */}
      <div
        className="pointer-events-none absolute -inset-8 opacity-60"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 40%, hsl(41,55%,52%,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[hsl(222,40%,10%)] shadow-2xl shadow-black/50">
        {/* barra do navegador */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-[hsl(222,45%,8%)] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <div className="ml-3 flex-1 rounded-md bg-white/5 px-3 py-1 text-left text-[10px] text-slate-500">
            jurispi-ai.vercel.app/app/dashboard
          </div>
        </div>

        <div className="flex text-left">
          {/* sidebar */}
          <div className="hidden w-40 shrink-0 border-r border-white/10 bg-[hsl(222,45%,7%)] p-3 sm:block">
            <div className="flex items-center gap-1.5 px-1 pb-3">
              <Scale className={`h-3.5 w-3.5 ${GOLD}`} />
              <span className="text-[11px] font-semibold text-white">
                JurisPI <span className={GOLD}>AI</span>
              </span>
            </div>
            {[
              { icon: LayoutDashboard, label: "Dashboard", active: true },
              { icon: Award, label: "Marcas" },
              { icon: Lightbulb, label: "Patentes" },
              { icon: Search, label: "Base INPI" },
              { icon: CalendarClock, label: "Prazos" },
              { icon: Bell, label: "Alertas" },
            ].map((item) => (
              <div
                key={item.label}
                className={`mb-1 flex items-center gap-2 rounded px-2 py-1.5 text-[10px] ${
                  item.active ? "bg-white/10 text-white" : "text-slate-400"
                }`}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
              </div>
            ))}
          </div>

          {/* conteúdo */}
          <div className="min-w-0 flex-1 p-4 sm:p-5">
            <p className="text-[11px] font-medium text-white">Monitoramento da carteira</p>
            <p className="text-[9px] text-slate-500">
              Sincronizado com o INPI • RPI 2846 processada
            </p>

            {/* cards */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: "Processos monitorados", value: "128" },
                { label: "Prazos em dia", value: "12/12" },
                { label: "Novos despachos", value: "3" },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
                  <p className="text-sm font-semibold text-white">{c.value}</p>
                  <p className="mt-0.5 text-[8px] leading-tight text-slate-400">{c.label}</p>
                </div>
              ))}
            </div>

            {/* alerta de prazo */}
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[hsl(41,55%,52%)]/40 bg-[hsl(41,55%,52%)]/10 px-3 py-2">
              <Bell className={`h-3.5 w-3.5 shrink-0 ${GOLD}`} />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium text-white">
                  Oposição publicada — marca “Café Serrano”
                </p>
                <p className="text-[9px] text-slate-400">
                  Prazo de manifestação: 60 dias • vence em 12/09
                </p>
              </div>
              <span className={`ml-auto shrink-0 rounded-full bg-[hsl(41,55%,52%)]/20 px-2 py-0.5 text-[8px] font-semibold ${GOLD}`}>
                Prazo novo
              </span>
            </div>

            {/* tabela */}
            <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-1.5 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Processo</span>
                <span>Situação</span>
                <span>Prazo</span>
              </div>
              {[
                {
                  nome: "Marca “Bella Moda” — 930123456",
                  situacao: "Exame de mérito",
                  cor: "text-sky-400",
                  prazo: "—",
                },
                {
                  nome: "Patente “Irrigação IoT” — BR102024...",
                  situacao: "Anuidade emitida",
                  cor: "text-emerald-400",
                  prazo: "GRU paga",
                },
                {
                  nome: "Marca “Café Serrano” — 931693691",
                  situacao: "Oposição publicada",
                  cor: "text-[hsl(41,55%,55%)]",
                  prazo: "12/09",
                },
              ].map((row) => (
                <div
                  key={row.nome}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-white/5 px-3 py-2 last:border-0"
                >
                  <span className="truncate text-[9px] text-slate-300">{row.nome}</span>
                  <span className={`text-[8px] font-medium ${row.cor}`}>{row.situacao}</span>
                  <span className="text-[8px] text-slate-400">{row.prazo}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[10px] text-slate-500">
        Ilustração da interface com dados fictícios.
      </p>
    </div>
  );
}
