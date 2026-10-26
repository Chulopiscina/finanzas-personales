"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { CalendarClock, Goal, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/planning", label: "Objetivos", icon: Goal },
  { href: "/planning/budget", label: "Presupuestos", icon: Wallet },
  {
    href: "/planning/recurring-payments",
    label: "Pagos recurrentes",
    icon: CalendarClock,
  },
];

export function PlanningNavigation() {
  const path = usePathname();
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const container = navigation.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !active) return;
    const link = active.getBoundingClientRect();
    const bounds = container.getBoundingClientRect();
    container.scrollLeft += link.left - bounds.left - (container.clientWidth - link.width) / 2;
  }, [path]);
  return (
    <nav
      ref={navigation}
      aria-label="Secciones de planificación"
      className="flex gap-1 overflow-x-auto border-b border-border"
    >
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          href={href}
          key={href}
          aria-current={path === href ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors",
            path === href
              ? "border-accent font-medium text-accent"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
