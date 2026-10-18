import { InputError } from "@/lib/input-error";
import { Prisma } from "@prisma/client";

export function cents(value: unknown): number {
  const decimal = new Prisma.Decimal(String(value ?? 0)).times(100);
  if (!decimal.isInteger() || !Number.isSafeInteger(decimal.toNumber())) {
    throw new InputError("El importe debe tener como máximo dos decimales y estar dentro del límite permitido.");
  }
  return decimal.toNumber();
}

export function euros(value: number): number {
  if (!Number.isSafeInteger(value)) throw new InputError("Importe fuera del límite permitido.");
  return new Prisma.Decimal(value).dividedBy(100).toNumber();
}

export function addMoney(...values: unknown[]): number {
  return euros(values.reduce<number>((sum, value) => sum + cents(value), 0));
}

export function sumMoney<T>(values: T[], amount: (value: T) => unknown): number {
  return euros(values.reduce((sum, value) => sum + cents(amount(value)), 0));
}

// Allocate whole cents deterministically; a shared refund is never counted twice.
export function allocateCents(total: number, weights: Array<{ id: string; cents: number }>): Map<string, number> {
  const ordered = [...weights].filter((w) => w.cents > 0).sort((a, b) => a.id.localeCompare(b.id));
  const weight = ordered.reduce((sum, w) => sum + BigInt(w.cents), 0n);
  if (!weight || total <= 0) return new Map();
  const rows = ordered.map((w) => {
    const product = BigInt(total) * BigInt(w.cents);
    return { id: w.id, amount: Number(product / weight), remainder: product % weight };
  });
  let remainder = total - rows.reduce((sum, row) => sum + row.amount, 0);
  for (const row of [...rows].sort((a, b) => a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1)) {
    if (remainder-- > 0) row.amount++;
  }
  return new Map(rows.map((row) => [row.id, row.amount]));
}
