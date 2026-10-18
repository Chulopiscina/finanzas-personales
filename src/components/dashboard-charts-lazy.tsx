"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { DashboardCharts } from "@/components/dashboard-charts";

const Charts = dynamic(() => import("@/components/dashboard-charts").then((mod) => mod.DashboardCharts), {
  loading: () => (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="h-[360px] animate-pulse rounded-2xl border border-border bg-card" />
      <div className="h-[360px] animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  )
});

export function DashboardChartsLazy(props: React.ComponentProps<typeof DashboardCharts>) {
  const anchor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!anchor.current) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(anchor.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={anchor} className="min-h-[360px]">{visible ? <Charts {...props} /> : <div className="h-[360px] animate-pulse rounded-2xl border border-border bg-card" role="status" aria-label="Cargando gráficos" />}</div>;
}
