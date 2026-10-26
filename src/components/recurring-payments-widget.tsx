"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { ServiceLogo } from "@/components/service-logo";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  calendarMonthLabel, compactMonthCalendarDays, occurrenceStatus, paymentFrequencyLabels,
  paymentsInMonth, shiftCalendarMonth, type CalendarPayment,
} from "@/lib/recurring-calendar";

function fullDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function RecurringPaymentsWidget({ payments, today }: { payments: CalendarPayment[]; today: string }) {
  const titleId = useId();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const paymentList = useRef<HTMLDivElement>(null);
  const occurrences = useMemo(() => paymentsInMonth(payments, month), [payments, month]);
  const byDay = useMemo(() => {
    const map = new Map<string, typeof occurrences>();
    for (const occurrence of occurrences) {
      const day = map.get(occurrence.date) ?? [];
      day.push(occurrence);
      map.set(occurrence.date, day);
    }
    return map;
  }, [occurrences]);
  const visible = selectedDay ? byDay.get(selectedDay) ?? [] : occurrences;
  const total = occurrences.reduce((sum, { payment }) => sum + Math.round(payment.amount * 100), 0) / 100;
  const label = calendarMonthLabel(month).replace(" de ", " ");

  useEffect(() => {
    const list = paymentList.current;
    if (!list) return;
    let first = 0;
    if (!selectedDay && month === today.slice(0, 7)) {
      const next = occurrences.findIndex((item) => item.date >= today);
      first = next < 0 ? Math.max(0, occurrences.length - 3) : Math.max(0, next - 1);
    }
    const row = list.children[first] as HTMLElement | undefined;
    // Keep one preceding payment for context without changing chronological order.
    list.scrollTop = row ? list.scrollTop + row.getBoundingClientRect().top - list.getBoundingClientRect().top : 0;
  }, [month, selectedDay, occurrences, today]);

  function selectMonth(value: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;
    setMonth(value);
    setSelectedDay(null);
  }

  return <section id="pagos-recurrentes" aria-labelledby={titleId} data-testid="recurring-payments-widget" className="recurring-widget order-first w-full min-w-0 max-w-[440px] scroll-mt-20 justify-self-center rounded-lg border border-border/80 bg-card shadow-sm lg:order-last lg:justify-self-end">
    <div className="recurring-widget-inner p-3">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 id={titleId} className="text-sm font-semibold text-foreground">Pagos recurrentes <span className="ml-1 text-xs font-normal text-muted-foreground">({occurrences.length})</span></h3>
        <Link href="/planning/recurring-payments" aria-label="Gestionar pagos recurrentes" title="Gestionar pagos recurrentes" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors duration-150 hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Plus className="h-4 w-4" /></Link>
      </header>

      <div className="mb-3 flex items-center justify-center gap-2">
        <button type="button" className="recurring-month-arrow" aria-label="Mes anterior de pagos" onClick={() => selectMonth(shiftCalendarMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></button>
        <label className="relative flex h-9 min-w-0 items-center justify-center gap-2 rounded-full bg-muted/65 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-accent">
          <span className="truncate first-letter:uppercase" aria-live="polite">{label}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input type="month" aria-label="Elegir mes de pagos" value={month} onChange={(event) => selectMonth(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <button type="button" className="recurring-month-arrow" aria-label="Mes siguiente de pagos" onClick={() => selectMonth(shiftCalendarMonth(month, 1))}><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground" aria-hidden="true">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="recurring-month-grid grid grid-cols-7 gap-1" role="group" aria-label={`Calendario de pagos: ${calendarMonthLabel(month)}`}>
        {compactMonthCalendarDays(month).map((date) => {
          const items = byDay.get(date) ?? [];
          const inMonth = date.startsWith(month);
          return <button key={date} type="button" disabled={!inMonth} aria-current={date === today ? "date" : undefined} aria-pressed={date === selectedDay} aria-label={`${fullDate(date)}${date === today ? ", hoy" : ""}: ${items.length} ${items.length === 1 ? "pago" : "pagos"}${items.length ? `, ${items.map((item) => item.payment.name).join(", ")}` : ""}`}
            title={items.length ? items.map(({ payment }) => payment.name).join(", ") : fullDate(date)} onClick={() => setSelectedDay(selectedDay === date ? null : date)}
            className={cn("recurring-day min-w-0 rounded-lg border text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", !inMonth && "opacity-30", date < today ? "text-muted-foreground" : "text-foreground", date === today && "recurring-day-today", date === selectedDay && "recurring-day-selected")}>
            <span className="recurring-day-number tabular-nums">{Number(date.slice(8))}</span>
            <span className="recurring-day-logo relative flex items-center justify-center">
              {items.length > 0 && <><ServiceLogo name={items[0].payment.name} className="recurring-calendar-logo" />
                {items.length > 1 && <span className="recurring-logo-count">+{items.length - 1}</span>}</>}
            </span>
          </button>;
        })}
      </div>

      {(selectedDay || month !== today.slice(0, 7)) && <div className="mt-2 flex min-h-6 items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{selectedDay ? fullDate(selectedDay) : "Previsiones del mes"}</span>
        {selectedDay
          ? <button type="button" className="flex shrink-0 items-center gap-1 text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" onClick={() => setSelectedDay(null)}><X className="h-3 w-3" />Ver mes</button>
          : month !== today.slice(0, 7) && <button type="button" className="shrink-0 text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" onClick={() => selectMonth(today.slice(0, 7))}>Mes actual</button>}
      </div>}

      <div ref={paymentList} className="recurring-payment-scroll mt-3 max-h-[216px] space-y-2 overflow-y-auto overscroll-y-contain" role="region" aria-label="Pagos del mes seleccionado" tabIndex={visible.length > 3 ? 0 : undefined}>
        {visible.length ? visible.map(({ id, payment, date }) => {
          const status = occurrenceStatus(date, today);
          return <article key={id} data-testid="widget-payment" data-date={date} className="recurring-payment-row flex min-w-0 items-center gap-3 rounded-lg px-3 py-3">
            <ServiceLogo name={payment.name} className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground" title={payment.name}>{payment.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{paymentFrequencyLabels[payment.frequency]}</p>
            </div>
            <div className="min-w-0 max-w-[48%] text-right">
              <p className="break-words text-lg font-semibold leading-tight tabular-nums text-foreground">{formatCurrency(payment.amount)}</p>
              <p className={cn("mt-1 text-xs", status.tone === "today" ? "text-orange-700 dark:text-[#f29a82]" : "text-muted-foreground")} title={`${fullDate(date)}${payment.accountName ? ` · ${payment.accountName}` : ""}${status.tone === "past" ? " · Sin confirmación de cobro" : ""}`}>{status.label}</p>
            </div>
          </article>;
        }) : <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 px-4 text-center text-xs text-muted-foreground">
          <CalendarDays className="h-5 w-5 text-accent/70" strokeWidth={1.5} />
          <p>{selectedDay ? "Sin pagos previstos para este día." : "Sin pagos previstos para este mes."}</p>
        </div>}
      </div>

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        <span>Total previsto <strong className="ml-1 font-semibold tabular-nums text-foreground">{formatCurrency(total)}</strong></span>
        <Link href="/planning/recurring-payments" className="flex min-h-7 items-center gap-1 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Gestionar<ArrowUpRight className="h-3 w-3" /></Link>
      </footer>
    </div>
  </section>;
}
