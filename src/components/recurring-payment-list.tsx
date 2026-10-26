"use client";

import { useState } from "react";
import { Archive, CalendarDays, Ellipsis, PauseCircle, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { ServiceLogo } from "@/components/service-logo";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { paymentFrequencyLabels, type CalendarPayment } from "@/lib/recurring-calendar";

type Actions<T> = {
  onEdit: (payment: T) => void;
  onStatus: (payment: T, status: "ACTIVE" | "PAUSED" | "CANCELED") => void;
  onDelete: (payment: T) => void;
  savingId: string | null;
};

function PaymentActions<T extends CalendarPayment>({ payment, onEdit, onStatus, onDelete, savingId }: Actions<T> & { payment: T }) {
  const [openAbove, setOpenAbove] = useState(false);
  function closeMenu(event: React.MouseEvent<HTMLButtonElement>) {
    const details = event.currentTarget.closest("details");
    details?.removeAttribute("open");
    details?.querySelector("summary")?.focus();
  }
  return <details className="payment-actions relative self-center" onToggle={(event) => {
    if (event.currentTarget.open) setOpenAbove(window.innerHeight - event.currentTarget.getBoundingClientRect().bottom < 260);
  }} onKeyDown={(event) => {
    if (event.key === "Escape") {
      event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
    }
  }}>
    <summary aria-label={`Acciones de ${payment.name}`} title={`Acciones de ${payment.name}`} className="flex h-10 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden sm:w-10"><Ellipsis className="h-5 w-5" /></summary>
    <div className={cn("absolute right-0 z-20 max-h-[min(16rem,calc(100dvh-10rem))] w-52 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1.5 shadow-xl", openAbove ? "bottom-full mb-2" : "top-11")} aria-label={`Opciones de ${payment.name}`}>
      <button type="button" className="payment-menu-item" disabled={savingId !== null} onClick={(event) => { closeMenu(event); onEdit(payment); }}><Pencil />Editar</button>
      <button type="button" className="payment-menu-item" disabled={savingId !== null} onClick={(event) => { closeMenu(event); onStatus(payment, payment.status === "ACTIVE" ? "PAUSED" : "ACTIVE"); }}>{payment.status === "ACTIVE" ? <PauseCircle /> : <PlayCircle />}{payment.status === "ACTIVE" ? "Pausar" : "Reactivar"}</button>
      {payment.status !== "CANCELED" && <button type="button" className="payment-menu-item" disabled={savingId !== null} onClick={(event) => { closeMenu(event); onStatus(payment, "CANCELED"); }}><Archive />Cancelar pago</button>}
      <button type="button" className="payment-menu-item text-danger" disabled={savingId !== null} onClick={(event) => { closeMenu(event); onDelete(payment); }}><Trash2 />Eliminar</button>
    </div>
  </details>;
}

export function RecurringPaymentList<T extends CalendarPayment>({ payments, ...actions }: Actions<T> & { payments: T[] }) {
  return <section aria-label="Pagos configurados" className="space-y-3">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">Pagos configurados</h2>
      <span className="text-xs text-muted-foreground">{payments.length} guardados</span>
    </div>
    {payments.length ? payments.map((payment) => <article key={payment.id} data-testid="configured-payment" className="payment-schedule-card flex items-center gap-3 rounded-lg border border-border bg-card p-4 sm:gap-4 sm:p-5">
      <ServiceLogo name={payment.name} className="h-10 w-10 sm:h-12 sm:w-12" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold sm:text-base" title={payment.name}>{payment.name}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">{paymentFrequencyLabels[payment.frequency]} · {payment.accountName ?? "Sin cuenta"}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Fecha configurada: {formatDate(payment.nextChargeDate)}</p>
      </div>
      <div className="min-w-0 max-w-[40%] space-y-1.5 text-right">
        <p className="break-words text-base font-semibold tabular-nums sm:text-lg">{formatCurrency(payment.amount)}</p>
        <Badge tone={payment.status === "ACTIVE" ? "success" : payment.status === "PAUSED" ? "warning" : "neutral"}>{payment.status === "ACTIVE" ? "Activo" : payment.status === "PAUSED" ? "Pausado" : "Cancelado"}</Badge>
      </div>
      <PaymentActions payment={payment} {...actions} />
    </article>) : <div className="empty-state"><CalendarDays className="h-6 w-6 text-accent" /><p>No tienes pagos recurrentes configurados.</p></div>}
  </section>;
}
