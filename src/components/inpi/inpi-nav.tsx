"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  { href: "/app/inpi", label: "Visão geral", exact: true },
  { href: "/app/inpi/search", label: "Busca" },
  { href: "/app/inpi/trademarks", label: "Marcas" },
  { href: "/app/inpi/patents", label: "Patentes" },
  { href: "/app/inpi/rpi", label: "RPI" },
  { href: "/app/inpi/monitoring", label: "Monitoramento" },
  { href: "/app/inpi/import", label: "Importar carteira" },
  { href: "/app/inpi/gru", label: "GRU / e-INPI" },
  { href: "/app/inpi/imports", label: "Importações" },
];

export function InpiNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b pb-px">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
