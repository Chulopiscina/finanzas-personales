import { RecurringPaymentFrequency } from "@prisma/client";

const DAY_MS = 86_400_000;

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonthsClamped(date: Date, months: number) {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

export function nextRecurringPaymentDate(date: Date, frequency: RecurringPaymentFrequency, now = new Date()) {
  const today = startOfUtcDay(now);
  let next = startOfUtcDay(date);

  if (next >= today) return next;
  if (frequency === RecurringPaymentFrequency.ONCE || frequency === RecurringPaymentFrequency.OTHER) return null;

  const months = frequency === RecurringPaymentFrequency.MONTHLY ? 1 : frequency === RecurringPaymentFrequency.QUARTERLY ? 3 : 12;
  const elapsed = (today.getUTCFullYear() - next.getUTCFullYear()) * 12 + today.getUTCMonth() - next.getUTCMonth();
  const steps = Math.max(1, Math.floor(elapsed / months));
  next = addMonthsClamped(date, steps * months);
  if (next < today) next = addMonthsClamped(date, (steps + 1) * months);

  return next >= today ? next : null;
}

export function daysUntil(date: Date, now = new Date()) {
  return Math.max(0, Math.ceil((startOfUtcDay(date).getTime() - startOfUtcDay(now).getTime()) / DAY_MS));
}
