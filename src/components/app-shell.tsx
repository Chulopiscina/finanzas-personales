"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
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
  Smartphone,
  Tags,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { request } from "@/lib/client-request";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useDialogFocus } from "@/components/use-dialog-focus";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    group: "Tu dinero",
  },
  {
    href: "/movements",
    label: "Movimientos",
    icon: WalletCards,
    group: "Tu dinero",
  },
  {
    href: "/accounts",
    label: "Cuentas",
    icon: FolderKanban,
    group: "Tu dinero",
  },
  {
    href: "/statistics",
    label: "Estadísticas",
    icon: BarChart3,
    group: "Tu dinero",
  },
  {
    href: "/planning",
    label: "Planificación",
    icon: CalendarCheck,
    group: "Organización",
  },
  {
    href: "/categories",
    label: "Categorías",
    icon: Tags,
    group: "Organización",
  },
  {
    href: "/statements",
    label: "Extractos subidos",
    icon: FileText,
    group: "Organización",
  },
  {
    href: "/upload",
    label: "Subir CSV/PDF",
    icon: Upload,
    group: "Organización",
  },
  { href: "/profile", label: "Perfil", icon: UserRound, group: "Preferencias" },
];

export function AppShell({
  user,
  children,
  shortcutsAvailable = false,
}: {
  user: SessionUser;
  children: React.ReactNode;
  shortcutsAvailable?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useDialogFocus(open, () => setOpen(false));
  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }
  async function logout() {
    const response = await request("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      window.alert("No se pudo cerrar la sesión. Inténtalo de nuevo.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }
  const items = [
    ...navItems,
    ...(shortcutsAvailable
      ? [
          {
            href: "/notifications",
            label: "Notificaciones",
            icon: Smartphone,
            group: "Preferencias",
          },
        ]
      : []),
    ...(user.role === "ADMIN"
      ? [
          {
            href: "/admin",
            label: "Administración",
            icon: Shield,
            group: "Preferencias",
          },
        ]
      : []),
  ];
  const activeLabel =
    items.find(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
    )?.label ?? "Finanzas";

  function renderSidebar(forceExpanded = false) {
    const compact = collapsed && !forceExpanded;
    return (
      <aside
        aria-label="Navegación principal"
        className={cn(
          "flex h-full min-h-0 flex-col overflow-y-auto border-r border-border bg-card px-3 py-5 transition-[width] duration-200",
          compact ? "w-20" : "w-60",
        )}
      >
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className={cn(
            "mb-5 flex h-12 shrink-0 items-center gap-3 px-2",
            compact && "justify-center px-0",
          )}
          aria-label="Finanzas, inicio"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <CircleDollarSign className="h-6 w-6" aria-hidden="true" />
          </span>
          {!compact ? (
            <div>
              <p className="text-base font-semibold">
                Finanzas<span className="text-accent">.</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Tu espacio personal
              </p>
            </div>
          ) : null}
        </Link>
        <nav className="flex-1 space-y-1" aria-label="Secciones">
          {items.map((item, index) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <div key={item.href}>
                {items[index - 1]?.group !== item.group && !compact ? (
                  <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {item.group}
                  </p>
                ) : null}
                <Link
                  href={item.href}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(item.href)}
                  onFocus={() => router.prefetch(item.href)}
                  onClick={() => setOpen(false)}
                  title={compact ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-10 items-center gap-3 rounded-lg border px-3 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    compact && "justify-center px-0",
                    active
                      ? "border-accent/15 bg-accent/10 font-semibold text-accent"
                      : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon
                    className="h-[18px] w-[18px] shrink-0"
                    aria-hidden="true"
                  />
                  {!compact ? (
                    <span className="truncate">{item.label}</span>
                  ) : null}
                  {active && !compact ? (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
                  ) : null}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="mt-5 shrink-0 space-y-3 border-t border-border pt-4">
          <div
            className={cn(
              "flex items-center gap-2",
              compact ? "flex-col" : "justify-between px-2",
            )}
          >
            {!compact ? (
              <Link
                href="/profile"
                className="flex min-w-0 items-center gap-2"
                onClick={() => setOpen(false)}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {user.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">
                    {user.name}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {user.role === "ADMIN"
                      ? "Administrador"
                      : "Cuenta personal"}
                  </span>
                </span>
              </Link>
            ) : null}
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between gap-1">
            <Button
              variant="ghost"
              size={compact ? "icon" : "sm"}
              className={compact ? "mx-auto" : "justify-start"}
              onClick={logout}
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
              {!compact ? "Cerrar sesión" : null}
            </Button>
            {!forceExpanded ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapsed}
                title={compact ? "Expandir menú" : "Contraer menú"}
                className={compact ? "hidden" : "hidden lg:inline-flex"}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          {compact ? (
            <Button
              variant="ghost"
              size="icon"
              className="mx-auto flex"
              onClick={toggleCollapsed}
              title="Expandir menú"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </aside>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen lg:grid transition-[grid-template-columns] duration-200",
        collapsed
          ? "lg:grid-cols-[5rem_minmax(0,1fr)]"
          : "lg:grid-cols-[15rem_minmax(0,1fr)]",
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-3 focus:text-accent-foreground"
      >
        Saltar al contenido
      </a>
      <div className="sticky top-0 hidden h-dvh lg:block">
        {renderSidebar()}
      </div>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <CircleDollarSign
              className="h-5 w-5 shrink-0 text-accent lg:hidden"
              aria-hidden="true"
            />
            <span className="hidden text-xs text-muted-foreground lg:inline">
              Finanzas personales
            </span>
            <span className="hidden text-xs text-muted-foreground lg:inline">
              /
            </span>
            <span className="truncate text-xs font-medium">{activeLabel}</span>
          </div>
          <Link
            href="/upload"
            className="hidden items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-accent sm:flex"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar extracto
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            title="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </header>
        <main
          id="main-content"
          className="min-w-0 px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:pb-10"
        >
          <div
            key={pathname}
            className="app-content mx-auto w-full max-w-[1600px]"
          >
            {children}
          </div>
        </main>
      </div>
      <nav
        aria-label="Acceso rápido"
        className="mobile-dock fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 pt-2 backdrop-blur-md lg:hidden"
      >
        {[navItems[0], navItems[1], navItems[4]].map(
          ({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={
                label === "Dashboard"
                  ? "Ir al inicio"
                  : `Ir a ${label.toLowerCase()}`
              }
              aria-current={pathname.startsWith(href) ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 text-[10px]",
                pathname.startsWith(href)
                  ? "font-semibold text-accent"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label === "Dashboard" ? "Inicio" : label}
            </Link>
          ),
        )}
        <button
          onClick={() => setOpen(true)}
          className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground"
          aria-label="Más secciones"
        >
          <Menu className="h-5 w-5" />
          Más
        </button>
      </nav>
      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 !max-h-none !overflow-visible"
            onClick={(event) => event.stopPropagation()}
          >
            {renderSidebar(true)}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setOpen(false)}
              title="Cerrar menú"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
