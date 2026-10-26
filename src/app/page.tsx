import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Award,
  Banknote,
  Bell,
  BookOpenCheck,
  Bot,
  Briefcase,
  CalendarClock,
  Database,
  FolderKanban,
  Landmark,
  LockKeyhole,
  Quote,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { AppMockup } from "@/components/landing/app-mockup";
import { DemoForm } from "@/components/landing/demo-form";
import { InpiFlow } from "@/components/landing/inpi-flow";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "JurisPI AI — Seu escritório de PI, organizado. Direto do INPI.",
  description:
    "Plataforma para escritórios e agências de propriedade industrial: busca e monitoramento ao vivo no INPI, prazos automáticos, emissão de GRU e gestão da carteira com IA. Criada pelo advogado Marcos Figueiredo Portela.",
};

const GOLD = "text-[hsl(41,55%,55%)]";

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${GOLD}`}>{kicker}</p>
      <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{title}</h2>
    </div>
  );
}

const DORES = [
  "Toda terça-feira, abrir a RPI e conferir processo por processo — torcendo para não deixar nada passar.",
  "Prazos anotados em planilha, agenda e post-it… e o frio na barriga: “será que não esqueci nenhum?”",
  "Entrar no site do INPI várias vezes por dia para consultar o mesmo processo.",
  "Emitir GRU manualmente, guia por guia, cliente por cliente.",
  "Informações do cliente num lugar, andamentos em outro, documentos em outro.",
  "Saber que um único prazo perdido pode custar a marca do cliente — e a sua responsabilidade profissional.",
];

const BENEFICIOS = [
  {
    icon: CalendarClock,
    title: "Durma tranquilo com os prazos",
    text: "Despachos do INPI viram prazos calculados automaticamente conforme a LPI, com alertas por e-mail antes do vencimento.",
  },
  {
    icon: Timer,
    title: "Sua semana de volta",
    text: "O monitoramento que consumia horas de conferência manual roda sozinho, toda semana, para toda a carteira.",
  },
  {
    icon: Search,
    title: "A resposta na hora em que o cliente pergunta",
    text: "Busca ao vivo de marcas e patentes, com o processo completo na tela em segundos.",
  },
  {
    icon: Banknote,
    title: "GRU sem sair do sistema",
    text: "Emita e acompanhe guias do INPI de dentro da plataforma, com boleto e código de barras prontos para enviar ao cliente.",
  },
  {
    icon: FolderKanban,
    title: "Carteira inteira em um só lugar",
    text: "Clientes, processos, documentos e andamentos conectados, sem caça a informação em três sistemas.",
  },
  {
    icon: Briefcase,
    title: "Comece em minutos, não em meses",
    text: "Informe o CNPJ do titular e importe a carteira inteira direto do INPI, sem digitação manual.",
  },
  {
    icon: Bot,
    title: "Pareceres com apoio de IA",
    text: "Análises de viabilidade de marca e relatórios preliminares gerados em minutos, para você revisar e assinar.",
  },
  {
    icon: LockKeyhole,
    title: "Segurança de escritório jurídico",
    text: "Credenciais cifradas (AES-256), dados isolados por escritório e trilha de auditoria de cada ação.",
  },
];

const OBJECOES = [
  {
    q: "“Mas os dados dos meus clientes ficam seguros?”",
    a: "Essa foi a primeira exigência do criador — que é advogado e responde pela OAB como você. Credenciais são cifradas com AES-256-GCM, cada escritório só acessa os próprios dados e toda ação fica registrada em trilha de auditoria, em conformidade com a LGPD.",
  },
  {
    q: "“Já me organizo com planilhas, sempre funcionou.”",
    a: "Até funciona — enquanto a carteira é pequena e nada passa despercebido. O problema da planilha é que ela não abre a RPI de terça-feira por você. O JurisPI faz o que a planilha nunca fará: vigiar o INPI sozinho.",
  },
  {
    q: "“Já uso outro software jurídico.”",
    a: "A maioria dos softwares jurídicos trata PI como um anexo: guardam o que você digita. O JurisPI é o contrário — ele busca a informação no INPI, ao vivo, e ainda emite a GRU. É feito para PI, não adaptado para PI.",
  },
  {
    q: "“IA em processo jurídico? Não confio.”",
    a: "Nós também não confiamos cegamente — por isso a IA do JurisPI apoia, não decide. Prazos vêm de regras da LPI programadas, dados vêm do INPI oficial, e os pareceres de IA são rascunhos para a sua revisão. A assinatura continua sendo sua.",
  },
  {
    q: "“Meu volume de processos é pequeno, não compensa.”",
    a: "Com volume pequeno, um único prazo perdido dói ainda mais — é um cliente inteiro. E é justamente o escritório enxuto que não tem estagiário para conferir a RPI toda semana.",
  },
];

const FAQ = [
  {
    q: "Os dados vêm mesmo do INPI?",
    a: "Sim. A busca e o monitoramento consultam a base pública oficial do INPI em tempo real — a mesma fonte que você consultaria manualmente.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. O JurisPI roda no navegador, no computador e no celular.",
  },
  {
    q: "Quanto tempo leva para começar?",
    a: "Minutos. Você informa o CNPJ ou nome do titular e a plataforma importa a carteira direto do INPI.",
  },
  {
    q: "Serve para quem não é especialista em PI?",
    a: "Sim. Escritórios generalistas que têm alguns casos de marca usam o JurisPI justamente para não precisar dominar a rotina do INPI.",
  },
  {
    q: "Como funciona a emissão de GRU?",
    a: "Você conecta a conta e-INPI do escritório (a credencial fica cifrada) e emite as guias de dentro da plataforma, com o valor calculado pelo próprio INPI antes de confirmar.",
  },
  {
    q: "E se o INPI mudar o site?",
    a: "A plataforma é monitorada por testes automáticos que detectam mudanças no INPI, e a equipe atualiza a integração — essa manutenção é nossa, não sua.",
  },
  {
    q: "Meus dados ficam visíveis para outros escritórios?",
    a: "Nunca. Cada organização acessa apenas os próprios clientes, casos e documentos.",
  },
  {
    q: "Tem suporte?",
    a: "Sim, com onboarding guiado pela equipe nesta fase de acesso antecipado.",
  },
];

const INCLUSO = [
  "Busca ao vivo de marcas e patentes no INPI",
  "Monitoramento automático semanal da carteira",
  "Prazos calculados conforme a LPI, com alertas por e-mail",
  "Emissão e acompanhamento de GRU integrados",
  "Importação da carteira por titular (CNPJ/CPF)",
  "Gestão de clientes, processos e documentos",
  "Análises e pareceres com apoio de IA",
  "Onboarding guiado com a equipe",
];

export default async function LandingPage() {
  // Usuário logado vai direto para o app; visitante vê o site.
  const session = await auth();
  if (session?.user) redirect("/app/dashboard");

  return (
    <div className="min-h-screen bg-[hsl(222,45%,7%)] text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[hsl(222,45%,7%)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-[hsl(41,55%,52%)]/50">
              <Scale className={`h-5 w-5 ${GOLD}`} />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              JurisPI <span className={GOLD}>AI</span>
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Entrar
            </Link>
            <a
              href="#demonstracao"
              className="lp-btn rounded-md bg-[hsl(41,55%,52%)] px-4 py-2 text-sm font-semibold text-[hsl(41,60%,12%)] hover:bg-[hsl(41,60%,58%)]"
            >
              Solicitar demonstração
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(219,55%,20%) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <p className={`lp-hero-item lp-hero-1 text-xs font-semibold uppercase tracking-[0.25em] ${GOLD}`}>
            Propriedade industrial sem sustos
          </p>
          <h1 className="lp-hero-item lp-hero-2 mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Seu escritório de PI, organizado.{" "}
            <span className={GOLD}>Direto do INPI.</span>
          </h1>
          <p className="lp-hero-item lp-hero-3 mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            O JurisPI AI conecta seu escritório à fonte oficial: busca, monitoramento, prazos e
            GRU do INPI em um só lugar — com inteligência artificial e a segurança que a
            advocacia exige.
          </p>
          <div className="lp-hero-item lp-hero-4 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#demonstracao"
              className="lp-btn w-full rounded-md bg-[hsl(41,55%,52%)] px-8 py-3.5 text-sm font-semibold text-[hsl(41,60%,12%)] hover:bg-[hsl(41,60%,58%)] sm:w-auto"
            >
              Solicitar demonstração
            </a>
            <a
              href="#como-funciona"
              className="lp-btn w-full rounded-md border border-white/15 px-8 py-3.5 text-sm font-medium text-slate-200 hover:border-white/30 hover:text-white sm:w-auto"
            >
              Como funciona
            </a>
          </div>
          <p className="lp-hero-item lp-hero-4 mt-4 text-xs text-slate-400">
            Sem cartão de crédito • Demonstração guiada com processos reais do INPI
          </p>

          {/* Mockup do produto */}
          <div className="lp-hero-item lp-hero-5">
            <div className="lp-float">
              <AppMockup />
            </div>
          </div>

          {/* Faixa de confiança */}
          <div className="lp-hero-item lp-hero-6 mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Database, label: "Dados ao vivo da base oficial do INPI" },
              { icon: ShieldCheck, label: "Credenciais cifradas e LGPD desde o 1º dia" },
              { icon: Landmark, label: "Criado por advogado de PI, para advogados" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left"
              >
                <item.icon className={`h-5 w-5 shrink-0 ${GOLD}`} />
                <span className="text-xs leading-snug text-slate-300">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dor */}
      <section className="border-t border-white/10 bg-[hsl(222,40%,9%)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionTitle kicker="A rotina que você conhece" title="O INPI não avisa duas vezes" />
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate-400">
              Se você atua com propriedade industrial, provavelmente conhece bem essa rotina:
            </p>
          </Reveal>
          <Reveal>
            <div className="lp-stagger mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
              {DORES.map((dor) => (
                <div
                  key={dor}
                  className="lp-card rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm leading-relaxed text-slate-300"
                >
                  {dor}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Solução / mecanismo */}
      <section id="como-funciona" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionTitle kicker="O mecanismo" title="A fonte é o INPI. Ao vivo." />
          </Reveal>
          <Reveal>
          <div className="mx-auto mt-6 max-w-3xl space-y-4 text-center text-sm leading-relaxed text-slate-300 sm:text-base">
            <p>
              Enquanto outros sistemas trabalham com cópias desatualizadas de dados, o JurisPI
              consulta diretamente a base oficial — a mesma que você consultaria à mão. A
              diferença: ele faz isso automaticamente, para toda a sua carteira, e transforma
              cada despacho em prazo calculado conforme a LPI.
            </p>
            <p>
              E há uma segunda diferença, que explica todas as outras:{" "}
              <span className="font-medium text-white">
                o JurisPI não foi criado por uma empresa de software tentando entender advocacia.
              </span>{" "}
              Foi criado por um advogado de propriedade intelectual para resolver os problemas do
              próprio escritório. Cada função existe porque a prática exigiu.
            </p>
          </div>
          </Reveal>

          {/* Diagrama INPI → JurisPI → escritório */}
          <Reveal>
            <InpiFlow />
          </Reveal>

          {/* Passos */}
          <Reveal>
          <div className="lp-stagger mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              {
                n: "1",
                title: "Conecte a carteira",
                text: "Informe o CNPJ ou nome do titular e importe marcas e patentes direto do INPI.",
              },
              {
                n: "2",
                title: "Deixe o sistema vigiar",
                text: "Monitoramento semanal automático: cada despacho vira andamento, alerta e prazo.",
              },
              {
                n: "3",
                title: "Trabalhe com tudo na mão",
                text: "Busque ao vivo, emita GRU, gere análises com IA e atenda o cliente na hora.",
              },
            ].map((s) => (
              <div key={s.n} className="lp-card rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(41,55%,52%)]/15 text-sm font-semibold ${GOLD}`}
                >
                  {s.n}
                </span>
                <p className="mt-3 font-medium text-white">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.text}</p>
              </div>
            ))}
          </div>
          </Reveal>
        </div>
      </section>

      {/* Feito para */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionTitle kicker="Para quem é" title="Feito para quem responde pela carteira" />
          </Reveal>
          <Reveal>
          <div className="lp-stagger mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              {
                icon: Scale,
                title: "Escritórios de advocacia",
                text: "Atenda PI com a organização e a segurança que o cliente empresarial exige — sem virar refém de conferência manual.",
              },
              {
                icon: Briefcase,
                title: "Advogados autônomos",
                text: "Carteira inteira sob controle sem equipe de apoio: o sistema vigia o INPI enquanto você advoga.",
              },
              {
                icon: FolderKanban,
                title: "Agências de marcas e patentes",
                text: "Volume alto com processo padronizado: importação por titular, monitoramento em lote e GRU integrada.",
              },
            ].map((p) => (
              <div key={p.title} className="lp-card rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(41,55%,52%)]/15">
                  <p.icon className={`h-5 w-5 ${GOLD}`} />
                </span>
                <p className="mt-3 font-semibold text-white">{p.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.text}</p>
              </div>
            ))}
          </div>
          </Reveal>
        </div>
      </section>

      {/* Benefícios */}
      <section className="border-t border-white/10 bg-[hsl(222,40%,9%)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionTitle
              kicker="O que muda na prática"
              title="Menos conferência manual. Mais advocacia."
            />
          </Reveal>
          <Reveal>
          <div className="lp-stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFICIOS.map((b) => (
              <div key={b.title} className="lp-card rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <b.icon className={`h-6 w-6 ${GOLD}`} />
                <p className="mt-3 text-sm font-semibold text-white">{b.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{b.text}</p>
              </div>
            ))}
          </div>
          </Reveal>
        </div>
      </section>

      {/* Criador / prova social */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionTitle kicker="Quem criou" title="Feito por quem vive propriedade intelectual" />
          </Reveal>
          <Reveal>
          <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-[hsl(41,55%,52%)]/30 bg-gradient-to-b from-white/[0.05] to-transparent p-6 sm:p-10">
            <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
              <div className="lp-photo relative w-56 shrink-0 sm:w-64">
                <div
                  className="pointer-events-none absolute -inset-3 rounded-3xl opacity-70"
                  style={{
                    background:
                      "radial-gradient(60% 60% at 50% 40%, hsl(41,55%,52%,0.18) 0%, transparent 70%)",
                  }}
                />
                <div className="relative overflow-hidden rounded-2xl ring-2 ring-[hsl(41,55%,52%)]/50">
                  <Image
                    src="/marcos-portela.jpg"
                    alt="Marcos Figueiredo Portela, advogado criador do JurisPI AI"
                    width={640}
                    height={641}
                    priority={false}
                    className="h-auto w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[hsl(222,45%,7%)]/85 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-center">
                    <p className="text-sm font-semibold text-white">Marcos Figueiredo Portela</p>
                    <p className={`text-[11px] font-medium ${GOLD}`}>OAB • Advogado de PI</p>
                  </div>
                </div>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xl font-semibold text-white">Marcos Figueiredo Portela</p>
                <p className={`mt-0.5 text-sm font-medium ${GOLD}`}>
                  Advogado • Criador do JurisPI AI
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li className="flex items-start justify-center gap-2 sm:justify-start">
                    <Award className={`mt-0.5 h-4 w-4 shrink-0 ${GOLD}`} />
                    Agraciado com a Láurea de Mérito da OAB (2025)
                  </li>
                  <li className="flex items-start justify-center gap-2 sm:justify-start">
                    <Landmark className={`mt-0.5 h-4 w-4 shrink-0 ${GOLD}`} />
                    Diretor do CONJOVE — Conselho de Jovens Empresários da Associação Comercial
                    do Pará (2026)
                  </li>
                  <li className="flex items-start justify-center gap-2 sm:justify-start">
                    <BookOpenCheck className={`mt-0.5 h-4 w-4 shrink-0 ${GOLD}`} />
                    Sócio-fundador do Figueiredo Portela Advocacia, com atuação dedicada à
                    propriedade intelectual
                  </li>
                </ul>
                <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <Quote className={`h-4 w-4 ${GOLD}`} />
                  <p className="mt-2 text-sm italic leading-relaxed text-slate-300">
                    O JurisPI nasceu dentro do meu escritório, da necessidade real de nunca perder
                    um prazo do INPI e de atender cada cliente com a informação na mão. Só depois
                    de funcionar para mim, decidi abrir para outros colegas.
                  </p>
                </div>
              </div>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      {/* O que está incluso */}
      <section className="border-t border-white/10 bg-[hsl(222,40%,9%)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionTitle kicker="Acesso antecipado" title="O que está incluso" />
          </Reveal>
          <Reveal>
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <ul className="space-y-3">
              {INCLUSO.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-200">
                  <Sparkles className={`mt-0.5 h-4 w-4 shrink-0 ${GOLD}`} />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-white/10 pt-5 text-center">
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">Veja funcionando antes de decidir.</span>{" "}
                A demonstração usa dados reais do INPI, sem cartão e sem compromisso. Se não fizer
                sentido para a sua rotina, você fecha a aba e nada acontece.
              </p>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      {/* Objeções */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionTitle kicker="Falando francamente" title="O que todo advogado pergunta antes" />
          </Reveal>
          <Reveal>
          <div className="lp-stagger mx-auto mt-8 max-w-3xl space-y-4">
            {OBJECOES.map((o) => (
              <div key={o.q} className="lp-card rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <p className="font-medium text-white">{o.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{o.a}</p>
              </div>
            ))}
          </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/10 bg-[hsl(222,40%,9%)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <SectionTitle kicker="Perguntas frequentes" title="Tudo o que você precisa saber" />
          </Reveal>
          <Reveal>
          <div className="lp-stagger mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q} className="lp-card rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm font-semibold text-white">{f.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.a}</p>
              </div>
            ))}
          </div>
          </Reveal>
        </div>
      </section>

      {/* CTA final + formulário */}
      <section id="demonstracao" className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <Bell className={`mx-auto h-8 w-8 ${GOLD}`} />
              <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
                Na próxima terça-feira, a RPI sai de novo.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                Você pode passá-la conferindo processo por processo — ou pode deixar o JurisPI
                fazer isso enquanto você advoga.
              </p>
            </div>
          </Reveal>
          <Reveal>
            <div className="lp-glow mx-auto mt-8 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <DemoForm />
            </div>
          </Reveal>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm italic leading-relaxed text-slate-400">
            P.S. — O JurisPI AI não nasceu numa startup de tecnologia. Nasceu na rotina de um
            escritório de advocacia em Belém, da mão de um advogado que cansou de temer a RPI de
            terça-feira. Se você vive essa rotina, ele foi feito para você.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[hsl(222,45%,6%)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <div className="flex items-center gap-2">
            <Scale className={`h-4 w-4 ${GOLD}`} />
            <span className="text-sm font-medium text-white">
              JurisPI <span className={GOLD}>AI</span>
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Análise assistiva. Não substitui consulta profissional ou oficial ao INPI.
          </p>
          <nav className="flex items-center gap-4 text-xs text-slate-400">
            <Link href="/termos" className="hover:text-slate-200">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="hover:text-slate-200">
              Privacidade
            </Link>
            <Link href="/login" className="hover:text-slate-200">
              Entrar
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
