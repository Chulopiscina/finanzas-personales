"use client";

import dynamic from "next/dynamic";

export const DashboardChartsLazy = dynamic(() => import("@/components/dashboard-charts").then((mod) => mod.DashboardCharts), {
  loading: () => (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="h-[360px] animate-pulse rounded-2xl border border-border bg-card" />
      <div className="h-[360px] animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  )
});