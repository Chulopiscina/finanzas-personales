import { createHash } from "node:crypto";
import { TransactionType } from "@prisma/client";
import Papa from "papaparse";

export type ParsedMovement = {
  date: Date;
  concept: string;
  amount: number;
  balance: number | null;
  type: TransactionType;
  categoryName: string;
  sourceHash: string;
  raw: Record<string, string>;
};

const categoryRules: Array<[string, RegExp]> = [
  ["Nómina", /\b(nomina|n[oó]mina|salario|p[ao]yroll|haberes)\b/i],
  ["Restaurantes", /\b(restaurante|bar |cafeter[ií]a|burger|pizza|glovo|uber eats|deliveroo|just eat)\b/i],
  ["Supermercado", /\b(mercadona|carrefour|lidl|aldi|bonpreu|caprabo|supermercado|consum|alcampo|dia market)\b/i],
  ["Transporte", /\b(tmb|renfe|metro|bus|taxi|uber|cabify|transport|parking|peaje)\b/i],
  ["Gasolina", /\b(gasolinera|repsol|cepsa|bp |shell|galp|diesel|carburante)\b/i],
  ["Salud", /\b(farmacia|cl[ií]nica|hospital|dentista|seguro salud|mutua)\b/i],
  ["Compras", /\b(amazon|zara|mango|el corte ingl[eé]s|media markt|ikea|decathlon|tienda)\b/i],
  ["Suscripciones", /\b(netflix|spotify|hbo|disney|apple|google|prime|suscripci[oó]n|adobe|notion)\b/i],
  ["Vivienda", /\b(alquiler|hipoteca|luz|agua|gas natural|endesa|iberdrola|comunidad|seguro hogar)\b/i],
  ["Ocio", /\b(cine|teatro|concierto|entradas|ocio|steam|playstation|xbox)\b/i],
  ["Viajes", /\b(booking|airbnb|hotel|ryanair|vueling|iberia|renfe larga|viaje|aeropuerto)\b/i],
  ["Transferencias", /\b(transferencia|traspaso|bizum|recibida|emitida)\b/i],
  ["Alimentación", /\b(alimentaci[oó]n|panader[ií]a|fruter[ií]a|carnicer[ií]a)\b/i]
];

function normalizeHeader(header: string) {
  return header
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pick(row: Record<string, unknown>, names: string[]) {
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeader(key);
    if (names.includes(normalized) && value !== undefined && value !== null) {
      return String(value).trim();
    }
  }

  return "";
}

export function parseSpanishAmount(value: string) {
  let cleaned = value
    .replace(/\s/g, "")
    .replace(/"/g, "")
    .replace(/\+/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!cleaned) {
    return NaN;
  }

  const negative = cleaned.startsWith("-") || cleaned.endsWith("-");
  cleaned = cleaned.replace(/-/g, "");

  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (commaIndex !== -1 && dotIndex !== -1) {
    normalized = commaIndex > dotIndex
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (commaIndex !== -1) {
    normalized = cleaned.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  }

  const amount = Number(normalized);
  return negative ? -amount : amount;
}
export function parseSpanishDate(value: string) {
  const cleaned = value.trim();
  const european = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (european) {
    const day = Number(european[1]);
    const month = Number(european[2]) - 1;
    const year = Number(european[3].length === 2 ? `20${european[3]}` : european[3]);
    return new Date(Date.UTC(year, month, day));
  }

  const iso = new Date(cleaned);
  if (!Number.isNaN(iso.getTime())) {
    return iso;
  }

  throw new Error(`Fecha inválida: ${value}`);
}

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function classify(concept: string, amount: number) {
  const transferRule = categoryRules.find(([name]) => name === "Transferencias");
  const payrollRule = categoryRules.find(([name]) => name === "Nómina");

  if (payrollRule?.[1].test(concept)) {
    return { categoryName: "Nómina", type: TransactionType.INCOME };
  }

  if (transferRule?.[1].test(concept)) {
    return { categoryName: "Transferencias", type: TransactionType.TRANSFER };
  }

  const matched = categoryRules.find(([, rule]) => rule.test(concept));
  if (matched) {
    return {
      categoryName: matched[0],
      type: amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE
    };
  }

  return {
    categoryName: amount >= 0 ? "Transferencias" : "Otros",
    type: amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE
  };
}

export function csvFileHash(text: string) {
  return hashValue(text);
}

export function parseBBVACsv(text: string) {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV inválido: ${result.errors[0]?.message ?? "no se pudo leer el archivo"}`);
  }

  const movements = result.data.map((row, index) => {
    const dateValue = pick(row, ["fecha", "fecha operacion", "fecha de operacion", "f operacion"]);
    const concept = pick(row, [
      "concepto",
      "descripcion",
      "descripcion ampliada",
      "movimiento",
      "operacion"
    ]);
    const amountValue = pick(row, ["importe", "cantidad", "monto"]);
    const balanceValue = pick(row, ["saldo", "saldo disponible", "saldo contable"]);

    if (!dateValue || !concept || !amountValue) {
      throw new Error(`Faltan columnas obligatorias en la fila ${index + 2}.`);
    }

    const date = parseSpanishDate(dateValue);
    const amount = parseSpanishAmount(amountValue);
    const balance = balanceValue ? parseSpanishAmount(balanceValue) : null;

    if (!Number.isFinite(amount)) {
      throw new Error(`Importe inválido en la fila ${index + 2}.`);
    }

    const classification = classify(concept, amount);
    const normalizedKey = [
      date.toISOString().slice(0, 10),
      concept.toLowerCase().replace(/\s+/g, " ").trim(),
      amount.toFixed(2),
      balance === null || Number.isNaN(balance) ? "" : balance.toFixed(2)
    ].join("|");

    return {
      date,
      concept,
      amount,
      balance: balance === null || Number.isNaN(balance) ? null : balance,
      type: classification.type,
      categoryName: classification.categoryName,
      sourceHash: hashValue(normalizedKey),
      raw: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value === undefined ? "" : String(value)])
      )
    } satisfies ParsedMovement;
  });

  return movements;
}
