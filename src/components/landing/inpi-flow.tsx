import { Banknote, Bell, Bot, Landmark, MoveDown, MoveRight, Scale } from "lucide-react";

const GOLD = "text-[hsl(41,55%,55%)]";

/**
 * Diagrama do mecanismo: INPI (fonte oficial) → JurisPI → o que o
 * escritório recebe (prazos, GRU, análises). Ilustração em JSX puro.
 */
export function InpiFlow() {
  return (
    <div className="mx-auto mt-10 max-w-4xl" aria-hidden="true">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {/* Fonte */}
        <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15">
            <Landmark className="h-6 w-6 text-slate-300" />
          </span>
          <p className="mt-3 text-sm font-semibold text-white">INPI</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Base pública oficial: processos, despachos e a RPI de toda terça-feira.
          </p>
        </div>

        {/* seta */}
        <div className="flex items-center justify-center">
          <MoveDown className={`h-5 w-5 sm:hidden ${GOLD}`} />
          <div className="hidden flex-col items-center sm:flex">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              consulta ao vivo
            </span>
            <MoveRight className={`lp-pulse h-6 w-6 ${GOLD}`} />
          </div>
        </div>

        {/* JurisPI */}
        <div className="flex-1 rounded-xl border border-[hsl(41,55%,52%)]/40 bg-[hsl(41,55%,52%)]/[0.06] p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(219,55%,20%)] ring-2 ring-[hsl(41,55%,52%)]/60">
            <Scale className={`h-6 w-6 ${GOLD}`} />
          </span>
          <p className="mt-3 text-sm font-semibold text-white">JurisPI AI</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Monitora a carteira, lê cada despacho e aplica as regras de prazo da LPI.
          </p>
        </div>

        {/* seta */}
        <div className="flex items-center justify-center">
          <MoveDown className={`h-5 w-5 sm:hidden ${GOLD}`} />
          <div className="hidden flex-col items-center sm:flex">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              todo dia, sozinho
            </span>
            <MoveRight className={`lp-pulse h-6 w-6 ${GOLD}`} />
          </div>
        </div>

        {/* Saídas */}
        <div className="flex-1 space-y-2">
          {[
            { icon: Bell, title: "Alerta de prazo", text: "no seu e-mail, antes do vencimento" },
            { icon: Banknote, title: "GRU pronta", text: "boleto emitido de dentro do sistema" },
            { icon: Bot, title: "Análise com IA", text: "parecer preliminar para sua revisão" },
          ].map((s) => (
            <div
              key={s.title}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5"
            >
              <s.icon className={`h-4 w-4 shrink-0 ${GOLD}`} />
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold text-white">{s.title}</p>
                <p className="text-[10px] leading-snug text-slate-400">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
