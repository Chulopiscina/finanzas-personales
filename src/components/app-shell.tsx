"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CircleDollarSign,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Tags,
  Upload,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/movements", label: "Movimientos", icon: WalletCards },
  { href: "/upload", label: "Subir CSV", icon: Upload },
  { href: "/statistics", label: "Estadísticas", icon: BarChart3 },
  { href: "/profile", label: "Perfil", icon: UserRound }
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-card/85 px-4 py-4 backdrop-blur">
      <div className="flex h-12 items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-card-foreground">Finanzas</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}

        {user.role === "ADMIN" ? (
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
              pathname.startsWith("/admin")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Shield className="h-4 w-4" aria-hidden="true" />
            Administración
          </Link>
        ) : null}
      </nav>

      <div className="mt-4 border-t border-border pt-4">
        <div className="mb-3 flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.role}</p>
          </div>
          <ThemeToggle />
        </div>
        <Button type="button" variant="ghost" className="w-full justify-start" onClick={logout}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[18rem_1fr]">
      <div className="hidden lg:block">{sidebar}</div>

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
              {sidebar}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-3 top-3"
                onClick={() => setOpen(false)}
                title="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
