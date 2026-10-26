export type PaymentFrequency = "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONCE" | "OTHER";

export type CalendarPayment = {
  id: string;
  name: string;
  amount: number;
  nextChargeDate: string;
  frequency: PaymentFrequency;
  status: "ACTIVE" | "PAUSED" | "CANCELED";
  accountName: string | null;
  categoryName: string | null;
};

export type PaymentOccurrence<T = CalendarPayment> = {
  id: string;
  date: string;
  payment: T;
};

export const paymentFrequencyLabels: Record<PaymentFrequency, string> = {
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  ANNUAL: "Anual",
  ONCE: "Única vez",
  OTHER: "Otra (fecha manual)",
};

export function madridToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function calendarMonthLabel(month: string) {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

export function shiftCalendarMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function monthCalendarDays(month: string) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  // Six stable weeks keep the controls and payment list from jumping between months.
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(1 - mondayOffset + index);
    return date.toISOString().slice(0, 10);
  });
}

export function compactMonthCalendarDays(month: string) {
  const days = monthCalendarDays(month);
  const last = days.findLastIndex((date) => date.startsWith(month));
  return days.slice(0, Math.max(35, Math.ceil((last + 1) / 7) * 7));
}

export function paymentsInMonth<T extends CalendarPayment>(payments: T[], month: string): PaymentOccurrence<T>[] {
  const target = new Date(`${month}-01T00:00:00Z`);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return payments.flatMap((payment) => {
    if (payment.status !== "ACTIVE") return [];
    const anchor = new Date(payment.nextChargeDate);
    if (!Number.isFinite(anchor.getTime())) return [];
    const elapsed = (target.getUTCFullYear() - anchor.getUTCFullYear()) * 12
      + target.getUTCMonth() - anchor.getUTCMonth();
    if (elapsed < 0) return [];
    const interval = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12, ONCE: 0, OTHER: 0 }[payment.frequency];
    if (interval ? elapsed % interval !== 0 : elapsed !== 0) return [];
    // Always clamp from the original day: Jan 31 -> Feb 28 -> Mar 31.
    const date = `${month}-${String(Math.min(anchor.getUTCDate(), lastDay)).padStart(2, "0")}`;
    return [{ id: `${payment.id}:${date}`, date, payment }];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.payment.name.localeCompare(b.payment.name, "es") || a.id.localeCompare(b.id));
}

export function occurrenceStatus(date: string, today: string) {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days < 0) return { label: "Sin confirmar", tone: "past" as const };
  if (days === 0) return { label: "Hoy", tone: "today" as const };
  return { label: `en ${days} ${days === 1 ? "día" : "días"}`, tone: "future" as const };
}
