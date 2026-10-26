import Link from "next/link";
import { redirect } from "next/navigation";
import { Scale } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { Providers } from "@/components/providers";
import { MobileNav } from "@/components/mobile-nav";
import { OnboardingTour } from "@/components/onboarding-tour";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) {
    redirect("/login");
  }

  // Tutorial de boas-vindas: roda uma vez para contas novas.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardedAt: true },
  });
  const showOnboarding = user !== null && user.onboardedAt === null;
  const platformAdmin = isPlatformAdmin(session.user.email);

  return (
    <Providers>
      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <Link href="/app/dashboard" className="flex items-center gap-2.5 px-6 py-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-gold/50">
              <Scale className="h-5 w-5 text-gold" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              JurisPI <span className="text-gold">AI</span>
            </span>
          </Link>
          <div className="flex-1 overflow-y-auto py-2">
            <SidebarNav showPlatformAdmin={platformAdmin} />
          </div>
          <div className="border-t border-sidebar-border px-6 py-4">
            <p className="text-[11px] leading-snug text-sidebar-foreground/70">
              Análise assistiva. Não substitui consulta profissional ou oficial ao INPI.
            </p>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-h-screen flex-1 flex-col lg:pl-60">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card/95 px-2 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <MobileNav showPlatformAdmin={platformAdmin} />
              <span className="truncate font-medium text-foreground">
                {session.organizationName}
              </span>
            </div>
            <UserMenu
              name={session.user.name ?? "Usuário"}
              email={session.user.email ?? ""}
            />
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
      <OnboardingTour initialOpen={showOnboarding} />
    </Providers>
  );
}
