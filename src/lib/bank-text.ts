// Matching never replaces the original bank text stored with the movement.
export function bankText(value: string) {
  return value.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’'`]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function cleanBankDescription(value: string) {
  return value.replace(/\b[A-Z]{2}\d{2}(?:\s?\d){10,30}\b/g, "")
    .replace(/\b\d{12,19}\b/g, "")
    .replace(/^(?:pago con tarjeta(?: en| de)?|pagament amb targeta(?: a| en)?|card (?:payment|purchase)(?: at)?|compra con tarjeta)\s+/i, "")
    .replace(/\s+/g, " ").trim().slice(0, 1000) || value.trim().slice(0, 1000);
}

const multilingualRules: Array<[string, RegExp]> = [
  ["Restaurantes", /\b(restaurants?|cafeteries|cafeterias|coffee|cafes?|takeaway|menjars)\b/],
  ["Supermercado", /\b(supermercats?|supermarkets?|grocery|groceries)\b/],
  ["Gasolina", /\b(benzineres?|benzinera|gasolineres?|fuel|petrol|gas station|carburants?)\b/],
  ["Salud", /\b(farmacies?|farmacias?|pharmacy|health|sanitat|medicina|dentist)\b/],
  ["Transporte", /\b(transport|transportation|transporte|parking|aparcament|peatge|toll)\b/],
  ["Suscripciones", /\b(subscripcions?|subscription|subscriptions|netflix|spotify|apple com bill)\b/],
  ["Vivienda", /\b(lloguer|rent|rental|mortgage|hipoteca|electricitat|electricity|aigua)\b/],
  ["Compras", /\b(compres|shopping|amazon|clothing|roba|calcat|steam|lovable)\b/],
  ["Viajes", /\b(viatges?|travel|hotel|flight|vols)\b/],
  ["Ocio", /\b(lleure|leisure|entertainment|cinema|espectacles)\b/],
  ["Transferencias", /\b(transferencies?|traspassos?|transfer|transfers)\b/]
];
export function multilingualCategory(value: string) {
  const normalized = bankText(value);
  return multilingualRules.find(([, rule]) => rule.test(normalized))?.[0];
}
