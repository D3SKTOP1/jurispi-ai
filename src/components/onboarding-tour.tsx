"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  Bell,
  Bot,
  Briefcase,
  CalendarClock,
  Database,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Scale,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Evento global para reabrir o tutorial (item "Ver tutorial" no menu do usuário). */
export const OPEN_TUTORIAL_EVENT = "jurispi:open-tutorial";

interface StepBullet {
  /** Nome do elemento na tela (em negrito no card). */
  label: string;
  /** O que ele faz. */
  text: string;
}

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets?: StepBullet[];
  /**
   * Rota real a abrir neste passo: o tour navega até ela para mostrar a tela
   * de verdade e destaca o item correspondente na sidebar (via [data-tour]).
   * Sem href, o card aparece centralizado (boas-vindas / encerramento).
   */
  href?: string;
}

const STEPS: Step[] = [
  {
    icon: Scale,
    title: "Bem-vindo(a) ao JurisPI AI",
    description:
      "Este é um tour guiado: vamos navegar juntos pelas telas do sistema, uma a uma, explicando para que serve cada coisa. Leva uns 3 minutos.",
    bullets: [
      { label: "Como funciona", text: "a cada passo o sistema abre a tela real e destaca onde ela fica no menu" },
      { label: "Pode sair quando quiser", text: "e rever depois em: menu do usuário (canto superior direito) → Ver tutorial" },
      { label: "Navegação", text: "use os botões abaixo ou as setas ← → do teclado" },
    ],
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    href: "/app/dashboard",
    description:
      "A tela atrás deste card é sua visão geral diária — a primeira após o login.",
    bullets: [
      { label: "Indicadores no topo", text: "totais de clientes, processos, alertas abertos e prazos próximos" },
      { label: "Prazos e alertas recentes", text: "o que exige sua ação primeiro" },
      { label: "Últimos documentos e conversas", text: "atalhos para continuar de onde parou" },
    ],
  },
  {
    icon: Users,
    title: "Clientes",
    href: "/app/clients",
    description:
      "Os titulares e requerentes que seu escritório atende.",
    bullets: [
      { label: "Lista com busca", text: "encontre por nome ou CPF/CNPJ" },
      { label: "Novo cliente", text: "cadastro com documento e contatos" },
      { label: "Ficha do cliente", text: "clique em um cliente para ver os processos, documentos e prazos vinculados a ele" },
    ],
  },
  {
    icon: Briefcase,
    title: "Processos",
    href: "/app/cases",
    description:
      "Um processo para cada caso de PI: marca, patente, desenho industrial ou software. É a unidade central do sistema.",
    bullets: [
      { label: "Na lista", text: "status, nível de risco e próximo passo de cada caso" },
      { label: "Dentro do processo", text: "documentos, prazos, alertas, análises de IA e um chat contextualizado naquele caso" },
      { label: "Sincronizar com INPI", text: "botão que puxa os dados oficiais do processo (situação, despachos) direto da fonte" },
    ],
  },
  {
    icon: Award,
    title: "Marcas",
    href: "/app/trademarks",
    description:
      "Visão específica dos processos de marca, com os campos técnicos dessa natureza.",
    bullets: [
      { label: "Campos de marca", text: "classes de Nice, apresentação e elemento nominativo" },
      { label: "Risco de colisão", text: "score com motivos, calculado sobre a base pública do INPI" },
      { label: "Parecer com IA", text: "gere um parecer preliminar de registrabilidade — fica salvo e editável em Documentos gerados" },
    ],
  },
  {
    icon: Lightbulb,
    title: "Patentes",
    href: "/app/patents",
    description:
      "Visão específica dos processos de patente.",
    bullets: [
      { label: "Campos técnicos", text: "classificação IPC, inventores, datas de depósito e concessão" },
      { label: "Análise técnica com IA", text: "análise preliminar da invenção, também salva em Documentos gerados" },
    ],
  },
  {
    icon: FileText,
    title: "Documentos — sua base de conhecimento",
    href: "/app/documents",
    description:
      "Envie os arquivos do dia a dia: despachos, contratos, buscas, legislação.",
    bullets: [
      { label: "Upload", text: "PDF, TXT ou Markdown, com vínculo a cliente e processo" },
      { label: "Processamento automático", text: "o texto é extraído, dividido em trechos e indexado — acompanhe o status na própria lista" },
      { label: "Por que importa", text: "a IA usa esses trechos para responder com citações; quanto mais você envia, melhor ela responde" },
    ],
  },
  {
    icon: Database,
    title: "Base INPI — dados oficiais ao vivo",
    href: "/app/inpi",
    description:
      "O coração da plataforma: consulta direto no INPI, sem espelho desatualizado. As abas no topo da tela dividem as funções:",
    bullets: [
      { label: "Busca / Marcas / Patentes", text: "pesquise a base pública ao vivo, com análise de risco de colisão" },
      { label: "RPI", text: "edições da Revista da Propriedade Industrial" },
      { label: "Monitoramento", text: "processos vigiados — novas publicações viram alertas e prazos automaticamente" },
      { label: "Importar carteira", text: "informe CNPJ ou nome do titular e importe todas as marcas e patentes dele de uma vez" },
      { label: "GRU / e-INPI", text: "credencial e-INPI guardada em cofre criptografado" },
    ],
  },
  {
    icon: Bot,
    title: "Chat com IA",
    href: "/app/ai-chat",
    description:
      "Pergunte em linguagem natural: “A marca X tem risco na classe 42?”",
    bullets: [
      { label: "Respostas com fontes", text: "a IA consulta a base do INPI e seus documentos antes de responder — e sempre cita de onde tirou" },
      { label: "Histórico na lateral", text: "as conversas ficam salvas; há também um chat dentro de cada processo" },
    ],
  },
  {
    icon: Bell,
    title: "Alertas",
    href: "/app/alerts",
    description:
      "Avisos gerados pelo sistema, concentrados em um só lugar.",
    bullets: [
      { label: "Origem", text: "novas publicações da RPI em processos monitorados e vencimentos se aproximando" },
      { label: "Fluxo", text: "leia, resolva e arquive — o dashboard mostra quantos estão abertos" },
    ],
  },
  {
    icon: CalendarClock,
    title: "Prazos",
    href: "/app/deadlines",
    description:
      "O controle de prazos administrativos do escritório.",
    bullets: [
      { label: "Automáticos", text: "criados a partir dos despachos do INPI, segundo as regras da LPI" },
      { label: "Manuais", text: "registre também os seus" },
      { label: "Avisos", text: "alertas na plataforma e resumo diário por e-mail" },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Um lembrete importante",
    description:
      "Toda análise da plataforma é assistiva: apoia seu trabalho, mas não substitui advogado, agente da propriedade industrial ou consulta oficial ao INPI. Revise o que a IA produzir e valide nas fontes oficiais.",
    bullets: [
      { label: "Rever este tour", text: "menu do usuário (canto superior direito) → Ver tutorial" },
      { label: "Configurações", text: "troca de organização e gestão da conta ficam no fim do menu lateral" },
      { label: "Bom trabalho!", text: "explore à vontade — os dados são seus e ficam isolados na sua conta" },
    ],
  },
];

/** Margem do recorte de destaque em volta do item do menu. */
const SPOT_PADDING = 6;

export function OnboardingTour({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const navigatedRef = useRef(false);
  const startPathRef = useRef<string | null>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    function handleOpen() {
      setStep(0);
      setOpen(true);
    }
    window.addEventListener(OPEN_TUTORIAL_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_TUTORIAL_EVENT, handleOpen);
  }, []);

  // Guarda de onde o tour partiu, para devolver o usuário ao final.
  useEffect(() => {
    if (open && startPathRef.current === null) {
      startPathRef.current = pathname;
    }
  }, [open, pathname]);

  // Mostra a tela real do passo atual.
  useEffect(() => {
    if (!open) return;
    const href = STEPS[step].href;
    if (href && pathname !== href && !pathname.startsWith(`${href}/`)) {
      navigatedRef.current = true;
      router.push(href);
    }
  }, [open, step, pathname, router]);

  // Mede o item da sidebar a destacar (some no mobile → card centralizado).
  useEffect(() => {
    if (!open) return;
    const href = STEPS[step].href;
    const target = href
      ? document.querySelector<HTMLElement>(`[data-tour="${href}"]`)
      : null;

    function measure() {
      const r = target?.getBoundingClientRect();
      setRect(r && r.width > 0 && r.height > 0 ? r : null);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, step]);

  // Trava o scroll da página e habilita navegação por teclado.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (event.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
      if (event.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function finish() {
    setOpen(false);
    setStep(0);
    // Devolve o usuário à tela onde estava antes do tour.
    if (navigatedRef.current) {
      router.push(startPathRef.current ?? "/app/dashboard");
    }
    navigatedRef.current = false;
    startPathRef.current = null;
    // Marca como concluído (idempotente; ignora falhas de rede).
    fetch("/api/auth/onboarding-complete", { method: "POST" }).catch(() => undefined);
  }

  if (!open) return null;

  const Icon = current.icon;
  const spotlight = rect
    ? {
        left: rect.left - SPOT_PADDING,
        top: rect.top - SPOT_PADDING,
        width: rect.width + SPOT_PADDING * 2,
        height: rect.height + SPOT_PADDING * 2,
      }
    : null;
  const cardTop = spotlight
    ? Math.max(12, Math.min(spotlight.top - 8, (typeof window !== "undefined" ? window.innerHeight : 800) - 460))
    : undefined;

  return (
    <div role="dialog" aria-modal="true" aria-label="Tutorial do JurisPI AI">
      {/* Bloqueia cliques na página durante o tour. */}
      <div className="fixed inset-0 z-[55]" aria-hidden />

      {spotlight ? (
        /* Recorte de destaque: escurece tudo, menos o item do menu. */
        <div
          aria-hidden
          className="pointer-events-none fixed z-[56] rounded-lg ring-2 ring-gold transition-all duration-300"
          style={{
            left: spotlight.left,
            top: spotlight.top,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 z-[56] bg-slate-950/60" />
      )}

      {/* Card explicativo */}
      <div
        className={cn(
          "fixed z-[57] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-4 rounded-xl border bg-card p-5 shadow-2xl",
          "max-h-[min(37rem,calc(100vh-1.5rem))] overflow-y-auto",
          !spotlight && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
        style={spotlight ? { left: spotlight.left + spotlight.width + 16, top: cardTop } : undefined}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Passo {step + 1} de {STEPS.length}
            </p>
            <h2 className="text-base font-semibold leading-tight">{current.title}</h2>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{current.description}</p>

        {current.bullets && (
          <ul className="space-y-2 rounded-md bg-muted/60 p-3 text-sm">
            {current.bullets.map((bullet) => (
              <li key={bullet.label} className="flex gap-2">
                <span className="text-gold">•</span>
                <span>
                  <span className="font-medium text-foreground">{bullet.label}:</span>{" "}
                  <span className="text-muted-foreground">{bullet.text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Progresso */}
        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Passo ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          {step === 0 ? (
            <Button variant="ghost" size="sm" onClick={finish}>
              Pular tutorial
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              Anterior
            </Button>
          )}
          {isLast ? (
            <Button onClick={finish}>Começar a usar</Button>
          ) : (
            <Button onClick={() => setStep(step + 1)}>Próximo</Button>
          )}
        </div>
      </div>
    </div>
  );
}
