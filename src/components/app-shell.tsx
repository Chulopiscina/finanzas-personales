"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  CircleDollarSign,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Tags,
  Upload,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/movements", label: "Movimientos", icon: WalletCards },
  { href: "/upload", label: "Subir CSV/PDF", icon: Upload },
  { href: "/accounts", label: "Cuentas", icon: FolderKanban },
  { href: "/categories", label: "Categorías", icon: Tags },
  { href: "/planning", label: "Planificación", icon: CalendarCheck },
  { href: "/statistics", label: "Estadísticas", icon: BarChart3 },
  { href: "/statements", label: "Extractos subidos", icon: FileText },
  { href: "/profile", label: "Perfil", icon: UserRound }
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function renderSidebar(forceExpanded = false) {
    const isCollapsed = collapsed && !forceExpanded;

    return (
      <aside className={cn("flex h-full flex-col border-r border-border bg-card/95 px-3 py-4 shadow-sm backdrop-blur transition-[width] duration-200 ease-out dark:bg-card/85", isCollapsed ? "w-20" : "w-72")}>
        <div className={cn("flex h-12 items-center gap-3 px-2", isCollapsed && "justify-center px-0")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/15">
            <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
          </div>
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-card-foreground">Finanzas</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          ) : null}
        </div>

        <div className={cn("mt-5 hidden lg:flex", isCollapsed ? "justify-center" : "justify-end")}>
          <Button type="button" variant="ghost" size="icon" onClick={toggleCollapsed} title={isCollapsed ? "Expandir menú" : "Contraer menú"}>
            {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30",
                  isCollapsed && "justify-center px-0",
                  active ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
              </Link>
            );
          })}

          {user.role === "ADMIN" ? (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              title={isCollapsed ? "Administración" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30",
                isCollapsed && "justify-center px-0",
                pathname.startsWith("/admin") ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!isCollapsed ? <span>Administración</span> : null}
            </Link>
          ) : null}
        </nav>

        <div className="mt-4 border-t border-border pt-4">
          <div className={cn("mb-3 flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2", isCollapsed ? "justify-center px-2" : "justify-between")}>
            {!isCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.role}</p>
              </div>
            ) : null}
            <ThemeToggle />
          </div>
          <Button type="button" variant="ghost" className={cn("w-full", isCollapsed ? "justify-center px-0" : "justify-start")} onClick={logout} title={isCollapsed ? "Cerrar sesión" : undefined}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {!isCollapsed ? "Cerrar sesión" : null}
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <div className={cn("min-h-screen transition-[grid-template-columns] duration-200 ease-out lg:grid", collapsed ? "lg:grid-cols-[5rem_1fr]" : "lg:grid-cols-[18rem_1fr]")}>
      <div className="hidden lg:block">{renderSidebar()}</div>

      <div className="lg:hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="text-sm font-semibold">Finanzas</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(true)} title="Abrir menú">
            <Menu className="h-5 w-5" />
          </Button>
        </header>
        {open ? (
          <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm">
            <div className="absolute inset-y-0 left-0">
              {renderSidebar(true)}
              <Button type="button" variant="secondary" size="icon" className="absolute right-3 top-3" onClick={() => setOpen(false)} title="Cerrar menú">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
