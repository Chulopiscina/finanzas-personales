import { createHash } from "node:crypto";
import { cents } from "@/lib/money";
import type { ParsedMovement } from "@/lib/csv";

export function normalizeDescription(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
type ExistingMovement = { date: Date; concept: string; rawDescription?: string | null; amount: unknown; balance: unknown | null; raw?: unknown };
function reference(raw: unknown) {
  if (!raw || typeof raw !== "object") return "";
  return Object.entries(raw).find(([key]) => /^(transaction[ _-]?id|bankReference)$/i.test(key))?.[1]?.toString() ?? "";
}
function identity(movement: ExistingMovement) {
  return `${movement.date.toISOString().slice(0, 10)}|${cents(movement.amount)}|${normalizeDescription(movement.rawDescription || movement.concept)}`;
}
export function planImport(movements: ParsedMovement[], existing: ExistingMovement[]) {
  const buckets = new Map<string, ExistingMovement[]>();
  const counts = new Map<string, number>();
  for (const movement of existing) {
    const key = identity(movement);
    buckets.set(key, [...(buckets.get(key) ?? []), movement]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const occurrences = new Map<string, number>();
  const inserts: ParsedMovement[] = [];
  let duplicates = 0;
  for (const movement of movements) {
    const key = identity(movement);
    const candidates = buckets.get(key) ?? [];
    const ref = reference(movement.raw);
    const index = candidates.findIndex((candidate) => {
      const otherRef = reference(candidate.raw);
      if (ref && otherRef && ref !== otherRef) return false;
      return candidate.balance === null || movement.balance === null || cents(candidate.balance) === cents(movement.balance);
    });
    if (index >= 0) {
      candidates.splice(index, 1);
      duplicates++;
      continue;
    }
    const ordinal = (occurrences.get(key) ?? counts.get(key) ?? 0) + 1;
    occurrences.set(key, ordinal);
    inserts.push({ ...movement, sourceHash: createHash("sha256").update(`v2|${key}|${ref}|${ordinal}`).digest("hex") });
  }
  return { inserts, duplicates };
}
