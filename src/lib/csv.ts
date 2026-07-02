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

const CATEGORY_NAMES = {
  payroll: "N\u00f3mina",
  food: "Alimentaci\u00f3n",
  restaurants: "Restaurantes",
  supermarket: "Supermercado",
  transport: "Transporte",
  fuel: "Gasolina",
  health: "Salud",
  shopping: "Compras",
  subscriptions: "Suscripciones",
  housing: "Vivienda",
  leisure: "Ocio",
  travel: "Viajes",
  transfers: "Transferencias",
  other: "Otros"
};

const categoryRules: Array<[string, RegExp]> = [
  [CATEGORY_NAMES.payroll, /\b(nomina|n[o\u00f3]mina|salario|payroll|haberes)\b/i],
  [CATEGORY_NAMES.restaurants, /\b(restaurante|rest\b|bar |cafeter[i\u00ed]a|burger|pizza|glovo|uber eats|deliveroo|just eat)\b/i],
  [CATEGORY_NAMES.supermarket, /\b(mercadona|carrefour|lidl|aldi|bonpreu|caprabo|supermercado|consum|alcampo|dia market)\b/i],
  [CATEGORY_NAMES.transport, /\b(tmb|renfe|metro|bus|taxi|uber|cabify|transport|parking|peaje)\b/i],
  [CATEGORY_NAMES.fuel, /\b(gasolinera|repsol|cepsa|bp |shell|galp|diesel|carburante)\b/i],
  [CATEGORY_NAMES.health, /\b(farmacia|cl[i\u00ed]nica|hospital|dentista|seguro salud|mutua)\b/i],
  [CATEGORY_NAMES.shopping, /\b(amazon|zara|mango|uniqlo|el corte ingl[e\u00e9]s|media markt|ikea|decathlon|tienda)\b/i],
  [CATEGORY_NAMES.subscriptions, /\b(netflix|spotify|hbo|disney|apple|google|prime|suscripci[o\u00f3]n|adobe|notion)\b/i],
  [CATEGORY_NAMES.housing, /\b(alquiler|hipoteca|luz|agua|gas natural|endesa|iberdrola|comunidad|seguro hogar)\b/i],
  [CATEGORY_NAMES.leisure, /\b(cine|teatro|concierto|entradas|ocio|steam|playstation|xbox|atrapalo)\b/i],
  [CATEGORY_NAMES.travel, /\b(booking|airbnb|hotel|ryanair|vueling|iberia|renfe larga|viaje|aeropuerto)\b/i],
  [CATEGORY_NAMES.transfers, /\b(transferencia|traspaso|transfer|incoming transfer|outgoing transfer|recibida|emitida)\b/i],
  [CATEGORY_NAMES.food, /\b(alimentaci[o\u00f3]n|panader[i\u00ed]a|fruter[i\u00ed]a|carnicer[i\u00ed]a)\b/i]
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

function toRaw(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value === undefined || value === null ? "" : String(value)])
  );
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

  throw new Error(`Fecha inv\u00e1lida: ${value}`);
}

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function classify(concept: string, amount: number) {
  const transferRule = categoryRules.find(([name]) => name === CATEGORY_NAMES.transfers);
  const payrollRule = categoryRules.find(([name]) => name === CATEGORY_NAMES.payroll);

  if (payrollRule?.[1].test(concept)) {
    return { categoryName: CATEGORY_NAMES.payroll, type: TransactionType.INCOME };
  }

  if (transferRule?.[1].test(concept)) {
    return { categoryName: CATEGORY_NAMES.transfers, type: TransactionType.TRANSFER };
  }

  const matched = categoryRules.find(([, rule]) => rule.test(concept));
  if (matched) {
    return {
      categoryName: matched[0],
      type: amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE
    };
  }

  return {
    categoryName: amount >= 0 ? CATEGORY_NAMES.transfers : CATEGORY_NAMES.other,
    type: amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE
  };
}

export function csvFileHash(text: string) {
  return hashValue(text);
}

function normalizedKey(date: Date, concept: string, amount: number, balance: number | null, stableId?: string) {
  return [
    stableId || "",
    date.toISOString().slice(0, 10),
    concept.toLowerCase().replace(/\s+/g, " ").trim(),
    amount.toFixed(2),
    balance === null || Number.isNaN(balance) ? "" : balance.toFixed(2)
  ].join("|");
}

function parseCsvRows(text: string) {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV inv\u00e1lido: ${result.errors[0]?.message ?? "no se pudo leer el archivo"}`);
  }

  return result.data;
}

function isTradeRepublicCsv(rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? {}).map(normalizeHeader);
  return ["datetime", "date", "amount", "currency", "transaction id"].every((header) => headers.includes(header));
}

export function parseTradeRepublicCsv(text: string) {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return [];
  }

  if (!isTradeRepublicCsv(rows)) {
    throw new Error("El CSV no tiene el formato esperado de Trade Republic.");
  }

  return rows.map((row, index) => {
    const dateValue = pick(row, ["date", "datetime"]);
    const amountValue = pick(row, ["amount"]);
    const name = pick(row, ["name"]);
    const description = pick(row, ["description"]);
    const typeValue = pick(row, ["type"]);
    const transactionId = pick(row, ["transaction id", "transaction id"]);
    const concept = [name, description || typeValue].filter(Boolean).join(" - ").trim();

    if (!dateValue || !amountValue || !concept) {
      throw new Error(`Faltan columnas obligatorias de Trade Republic en la fila ${index + 2}.`);
    }

    const date = parseSpanishDate(dateValue);
    const amount = parseSpanishAmount(amountValue);
    if (!Number.isFinite(amount)) {
      throw new Error(`Importe inv\u00e1lido en la fila ${index + 2}.`);
    }

    const classification = classify(concept, amount);
    return {
      date,
      concept,
      amount,
      balance: null,
      type: classification.type,
      categoryName: classification.categoryName,
      sourceHash: hashValue(normalizedKey(date, concept, amount, null, transactionId || undefined)),
      raw: { source: "trade-republic-csv", ...toRaw(row) }
    } satisfies ParsedMovement;
  });
}

export function parseBBVACsv(text: string) {
  const rows = parseCsvRows(text);

  return rows.map((row, index) => {
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
      throw new Error(`Importe inv\u00e1lido en la fila ${index + 2}.`);
    }

    const classification = classify(concept, amount);

    return {
      date,
      concept,
      amount,
      balance: balance === null || Number.isNaN(balance) ? null : balance,
      type: classification.type,
      categoryName: classification.categoryName,
      sourceHash: hashValue(normalizedKey(date, concept, amount, balance)),
      raw: toRaw(row)
    } satisfies ParsedMovement;
  });
}

export function parseBankCsv(text: string) {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return [];
  }

  if (isTradeRepublicCsv(rows)) {
    return parseTradeRepublicCsv(text);
  }

  return parseBBVACsv(text);
}
