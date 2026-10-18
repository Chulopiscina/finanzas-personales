import { bankText, cleanBankDescription } from "@/lib/bank-text";
import { classify, parseSpanishAmount, parseSpanishDate } from "@/lib/csv";
import { InputError } from "@/lib/input-error";
import { cents } from "@/lib/money";

export type NotificationInput = {
  eventId: string; body: string; title?: string; subtitle?: string; sourceApp?: string;
  occurredAt?: string; merchant?: string; bankReference?: string;
};

export function notificationInput(value: unknown): NotificationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Se esperaba un objeto JSON.");
  const input = value as Record<string, unknown>;
  const limits: Record<keyof NotificationInput, number> = { eventId: 128, body: 6000, title: 300, subtitle: 300, sourceApp: 100, occurredAt: 40, merchant: 300, bankReference: 150 };
  const result: Record<string, string> = {};
  for (const [key, max] of Object.entries(limits)) {
    if (input[key] === undefined || input[key] === null) continue;
    if (typeof input[key] !== "string" || input[key].length > max) throw new InputError(`Campo ${key} inválido.`);
    result[key] = input[key] as string;
  }
  if (!result.eventId?.trim() || !result.body?.trim()) throw new InputError("eventId y body son obligatorios.");
  return result as NotificationInput;
}

export function interpretNotification(input: NotificationInput) {
  const original = [input.title, input.subtitle, input.body].filter(Boolean).join(" ");
  const text = bankText(original);
  const reversed = /\b(anulad[oa]|anullat|cancelled|canceled|reversed|reversal|liberada|alliberada|released)\b/.test(text);
  const hold = /\b(preautorizacion|preautoritzacio|preauthorization|preauthorisation|retencion|retencio|hold|reserved|reservation|bloqueado|pendent|pending)\b/.test(text);
  const refund = /\b(reembolso|devolucion|devolucio|refund|refunded)\b/.test(text);
  const incoming = refund || /\b(recibid[oa]|rebut|rebuda|received|ingreso|ingres|deposit|nomina|nomines|salary|payroll)\b/.test(text);
  const outgoing = /\b(pago|pagament|pagat|paid|payment|purchase|compra|cargo|carrec|charge|spent|enviado|enviat|withdrawal|retirada)\b/.test(text);
  const numeric = "[+-]?(?:\\d{1,3}(?:[.,]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?";
  const currencies = "EUR\\b|€|USD\\b|GBP\\b";
  const tokens = [...original.replace(/[−–]/g, "-").matchAll(new RegExp(`(?<![\\d.,])(?:(${numeric})\\s*(${currencies})|(${currencies})\\s*(${numeric})(?![\\d.,]))`, "gi"))];
  const token = tokens.length === 1 ? tokens[0] : null;
  const value = token?.[1] ?? token?.[4];
  const currency = token ? (token[2] ?? token[3]).toUpperCase().replace("€", "EUR") : null;
  const parsed = value ? parseSpanishAmount(value) : NaN;
  const hasSign = Boolean(value && /^[+-]/.test(value));
  const ambiguousPrefixSign = Boolean(token?.[3] && /[+−–-]\s*$/.test(original.slice(0, token.index)));
  let amount: number | null = Number.isFinite(parsed) && currency === "EUR" && !ambiguousPrefixSign && (hasSign || incoming !== outgoing) ? parsed : null;
  if (amount !== null && !hasSign) amount = Math.abs(amount) * (incoming ? 1 : -1);
  let occurredAt: Date | null = null;
  if (input.occurredAt) occurredAt = parseSpanishDate(input.occurredAt);
  const merchant = input.merchant?.trim() || null;
  const complete = amount !== null && occurredAt !== null;
  const status = reversed ? "REVERSED" : hold ? "AUTHORIZATION" : complete ? "PENDING" : "REVIEW";
  return {
    amount, currency, occurredAt, merchant, bankReference: input.bankReference?.trim() || null,
    categoryName: amount === null ? null : classify(merchant || original, amount).categoryName,
    confidence: complete ? "media" : "baja", status,
    reason: reversed ? "Aviso de anulación/liberación; no equivale a un reembolso confirmado."
      : hold ? "Retención o preautorización: pendiente del cargo bancario definitivo."
      : !complete ? "Faltan fecha bancaria o importe inequívoco. No se usan la hora de recepción ni el saldo como sustitutos."
      : refund ? "Posible devolución: confirmar con extracto antes de enlazar a un gasto."
      : "Movimiento provisional; no afecta a saldos ni a gastos hasta su conciliación.",
  };
}

export function referenceFromRaw(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const entry = Object.entries(raw).find(([key]) => /^(transaction[ _-]?id|bankReference)$/i.test(key));
  return entry?.[1] ? String(entry[1]) : null;
}

export function matchesNotification(event: { amount: unknown; occurredAt: Date | null; merchant: string | null; bankReference: string | null }, tx: { amount: unknown; date: Date; concept: string; cleanDescription: string | null; raw: unknown }) {
  if (event.amount === null || !event.occurredAt || cents(event.amount) !== cents(tx.amount) || Math.abs(tx.date.getTime() - event.occurredAt.getTime()) > 3 * 86_400_000) return false;
  const reference = referenceFromRaw(tx.raw);
  if (event.bankReference && reference) return event.bankReference === reference;
  if (!event.merchant) return false;
  const merchant = bankText(cleanBankDescription(event.merchant));
  return merchant.length >= 4 && [tx.cleanDescription, tx.concept].some((value) => value && bankText(cleanBankDescription(value)) === merchant);
}
