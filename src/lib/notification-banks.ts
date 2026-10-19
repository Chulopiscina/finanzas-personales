import { bankText } from "@/lib/bank-text";
import { InputError } from "@/lib/input-error";

// Extend only this server catalogue/rules, not the distributed shortcut.
// Fixtures validate parsing, not physical notification delivery by these apps.
export const notificationBanks = [
  { id: "bbva", name: "BBVA", aliases: ["BBVA", "BBVA España"], status: "En pruebas · sin validación en iPhone" },
  { id: "ing", name: "ING", aliases: ["ING", "ING España", "ING Direct"], status: "En pruebas · sin validación en iPhone" },
  { id: "trade-republic", name: "Trade Republic", aliases: ["Trade Republic"], status: "En pruebas · sin validación en iPhone" },
] as const;

export function notificationBank(id: unknown) {
  const bank = notificationBanks.find(b => b.id === id);
  if (!bank) throw new InputError("Banco no configurado. No se asignará una cuenta automáticamente.");
  return bank;
}

export function identifyNotificationBank(input: { sourceApp?: string; title?: string; body: string; bankId?: string }) {
  // Hints are untrusted transport data, never authority to access an account.
  const matches = new Set<string>();
  if (input.bankId) {
    if (!notificationBanks.some(b => b.id === input.bankId)) return null;
    matches.add(input.bankId);
  }
  for (const bank of notificationBanks) for (const alias of bank.aliases) {
    const normalized = bankText(alias);
    if ([input.sourceApp, input.title].some(s => s && bankText(s) === normalized)) matches.add(bank.id);
    // Only a leading app label; mentioning another bank in a transfer is not identity.
    const line = input.body.split(/\r?\n/)[0];
    if (bankText(line) === normalized || (line.includes(":") && bankText(line.split(":")[0]) === normalized)) matches.add(bank.id);
  }
  return matches.size === 1 ? [...matches][0] : null;
}

export const bankNotificationRules: Record<string, { incoming: RegExp; outgoing: RegExp }> = {
  bbva: { incoming: /\b(abono de nomina|bizum recibido|bizum rebut|salary credited)\b/, outgoing: /\b(bizum enviado|bizum enviat|has pagado|has pagat|you paid)\b/ },
  ing: { incoming: /\b(te hemos abonado|hem abonat|we credited|incoming transfer)\b/, outgoing: /\b(te hemos cargado|hem carregat|we charged|outgoing transfer)\b/ },
  "trade-republic": { incoming: /\b(interest credited|interessos abonats|intereses abonados|cash received)\b/, outgoing: /\b(card transaction|operacion con tarjeta|operacio amb targeta|cash withdrawal)\b/ },
};
