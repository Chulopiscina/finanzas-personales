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
  const buckets = new Map<string, Set<ExistingMovement>>();
  const references = new Map<string, Set<ExistingMovement>>();
  const counts = new Map<string, number>();
  const referenceKey = (movement: ExistingMovement, ref: string) => `${movement.date.toISOString().slice(0, 10)}|${cents(movement.amount)}|${ref}`;
  for (const movement of existing) {
    const key = identity(movement);
    const bucket = buckets.get(key) ?? new Set<ExistingMovement>();
    bucket.add(movement);
    buckets.set(key, bucket);
    const ref = reference(movement.raw);
    if (ref) {
      const refKey = referenceKey(movement, ref), items = references.get(refKey) ?? new Set<ExistingMovement>();
      items.add(movement); references.set(refKey, items);
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const occurrences = new Map<string, number>();
  const inserts: ParsedMovement[] = [];
  let duplicates = 0;
  for (const movement of movements) {
    const key = identity(movement);
    const ref = reference(movement.raw);
    const candidates = ref ? new Set([...(references.get(referenceKey(movement, ref)) ?? []), ...(buckets.get(key) ?? [])]) : buckets.get(key) ?? new Set<ExistingMovement>();
    let match: ExistingMovement | undefined;
    for (const candidate of candidates) {
      const otherRef = reference(candidate.raw);
      if (ref && otherRef && ref !== otherRef) continue;
      if (candidate.balance !== null && movement.balance !== null && cents(candidate.balance) !== cents(movement.balance)) continue;
      match = candidate; break;
    }
    if (match) {
      buckets.get(identity(match))?.delete(match);
      const matchedRef = reference(match.raw);
      if (matchedRef) references.get(referenceKey(match, matchedRef))?.delete(match);
      duplicates++;
      continue;
    }
    const ordinal = (occurrences.get(key) ?? counts.get(key) ?? 0) + 1;
    occurrences.set(key, ordinal);
    inserts.push({ ...movement, sourceHash: createHash("sha256").update(`v2|${key}|${ref}|${ordinal}`).digest("hex") });
  }
  return { inserts, duplicates };
}
