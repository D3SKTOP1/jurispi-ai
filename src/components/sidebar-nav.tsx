"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Bell,
  Bot,
  Briefcase,
  CalendarClock,
  Database,
  FileOutput,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/clients", label: "Clientes", icon: Users },
  { href: "/app/cases", label: "Processos", icon: Briefcase },
  { href: "/app/trademarks", label: "Marcas", icon: Award },
  { href: "/app/patents", label: "Patentes", icon: Lightbulb },
  { href: "/app/documents", label: "Documentos", icon: FileText },
  { href: "/app/inpi", label: "Base INPI", icon: Database },
  { href: "/app/ai-chat", label: "Chat com IA", icon: Bot },
  { href: "/app/generated-documents", label: "Documentos gerados", icon: FileOutput },
  { href: "/app/alerts", label: "Alertas", icon: Bell },
  { href: "/app/deadlines", label: "Prazos", icon: CalendarClock },
  { href: "/app/settings", label: "Configurações", icon: Settings },
];

export function SidebarNav({
  onNavigate,
  showPlatformAdmin = false,
}: {
  onNavigate?: () => void;
  /** Item "Administração" (painel da plataforma) — só para superadmins. */
  showPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const visible = showPlatformAdmin
    ? [...items, { href: "/app/admin", label: "Administração", icon: ShieldCheck }]
    : items;

  return (
    <nav className="flex flex-col gap-1 px-3">
      {visible.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-tour={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
