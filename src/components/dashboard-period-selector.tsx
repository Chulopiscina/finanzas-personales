"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";
import type { DashboardPeriod, DashboardPeriodMode } from "@/lib/finance";

const calendarLabels: Record<string, string> = {
  "last-imported-month": "Último mes importado",
  "last-3-months": "Últimos 3 meses",
  "current-year": "Año actual",
  all: "Todo"
};

const payrollLabels: Record<string, string> = {
  "payroll-current": "Ciclo actual",
  "payroll-last-closed": "Último ciclo cerrado",
  "payroll-last-3": "Últimos 3 ciclos",
  "payroll-all": "Todos los ciclos"
};

const modeLabels: Record<DashboardPeriodMode, string> = {
  calendar: "Mes natural",
  payroll: "Ciclo de nómina"
};

const defaultPeriodByMode: Record<DashboardPeriodMode, DashboardPeriod> = {
  calendar: "last-imported-month",
  payroll: "payroll-current"
};

function updateDashboardParams(searchParams: URLSearchParams, mode: DashboardPeriodMode, period: DashboardPeriod) {
  const params = new URLSearchParams(searchParams.toString());
  if (mode === "payroll") params.set("periodMode", mode);
  else params.delete("periodMode");

  if (period !== defaultPeriodByMode[mode]) params.set("period", period);
  else params.delete("period");

  const query = params.toString();
  return "/dashboard" + (query ? "?" + query : "");
}

export function DashboardPeriodSelector({ period, periodMode }: { period: DashboardPeriod; periodMode: DashboardPeriodMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const labels = periodMode === "payroll" ? payrollLabels : calendarLabels;
  const selectedLabel = labels[period] ?? labels[defaultPeriodByMode[periodMode]];

  useEffect(() => {
    if (searchParams.has("periodMode")) return;
    const savedMode = window.localStorage.getItem("dashboard-period-mode") as DashboardPeriodMode | null;
    if (savedMode !== "payroll") return;
    const savedPeriod = (window.localStorage.getItem("dashboard-period") as DashboardPeriod | null) ?? "payroll-current";
    router.replace(updateDashboardParams(searchParams, savedMode, savedPeriod));
  }, [router, searchParams]);

  function changeMode(value: string) {
    const mode = value === "payroll" ? "payroll" : "calendar";
    const nextPeriod = defaultPeriodByMode[mode];
    window.localStorage.setItem("dashboard-period-mode", mode);
    window.localStorage.setItem("dashboard-period", nextPeriod);
    router.push(updateDashboardParams(searchParams, mode, nextPeriod));
  }

  function changePeriod(value: string) {
    const nextPeriod = value as DashboardPeriod;
    window.localStorage.setItem("dashboard-period-mode", periodMode);
    window.localStorage.setItem("dashboard-period", nextPeriod);
    router.push(updateDashboardParams(searchParams, periodMode, nextPeriod));
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="group relative flex h-12 min-w-0 items-center gap-3 rounded-full border border-border bg-card px-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 hover:border-accent/30 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] sm:min-w-44">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="pointer-events-none min-w-0 flex-1 truncate text-sm font-medium text-foreground">{modeLabels[periodMode]}</span>
        <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground transition duration-200 group-hover:text-foreground" aria-hidden="true" />
        <Select value={periodMode} onChange={(event) => changeMode(event.target.value)} aria-label="Seleccionar modo de periodo" className="absolute inset-0 h-full cursor-pointer opacity-0">
          {Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{periodMode === value ? "\u2713 " : ""}{label}</option>)}
        </Select>
      </label>

      <label className="group relative flex h-12 min-w-0 items-center gap-3 rounded-full border border-border bg-card px-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 hover:border-accent/30 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] sm:min-w-56">
        <span className="pointer-events-none min-w-0 flex-1 truncate text-sm font-medium text-foreground">{selectedLabel}</span>
        <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground transition duration-200 group-hover:text-foreground" aria-hidden="true" />
        <Select value={period} onChange={(event) => changePeriod(event.target.value)} aria-label="Seleccionar periodo" className="absolute inset-0 h-full cursor-pointer opacity-0">
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{period === value ? "\u2713 " : ""}{label}</option>)}
        </Select>
      </label>
    </div>
  );
}
