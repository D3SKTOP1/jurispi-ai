"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/sidebar-nav";

/** Menu de navegação para telas pequenas (a sidebar fixa só aparece em lg+). */
export function MobileNav({ showPlatformAdmin = false }: { showPlatformAdmin?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 border-sidebar-border bg-sidebar p-0 [&>button]:text-sidebar-foreground"
      >
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <Link
          href="/app/dashboard"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2.5 px-6 py-5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-gold/50">
            <Scale className="h-5 w-5 text-gold" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">
            JurisPI <span className="text-gold">AI</span>
          </span>
        </Link>
        <div className="overflow-y-auto py-2">
          <SidebarNav onNavigate={() => setOpen(false)} showPlatformAdmin={showPlatformAdmin} />
        </div>
        <div className="border-t border-sidebar-border px-6 py-4">
          <p className="text-[11px] leading-snug text-sidebar-foreground/70">
            Análise assistiva. Não substitui consulta profissional ou oficial ao INPI.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
