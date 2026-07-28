import { TransactionType } from "@prisma/client";
import { parseBBVACsv, parseTradeRepublicCsv, type ParsedMovement } from "@/lib/csv";
import { extractPdfText, parseBBVAPdf, parseCaixaBankPdfText, parseINGPdfText } from "@/lib/pdf";

export type ImportBankFormat = "AUTO" | "BBVA" | "TRADE_REPUBLIC" | "ING" | "CAIXABANK" | "UNSUPPORTED";
export type ImportValidationStatus = "correcto" | "aviso" | "error";
export type ImportConfidence = "alta" | "media" | "baja";

export type SerializedPreviewMovement = {
  date: string;
  concept: string;
  amount: number;
  balance: number | null;
  type: TransactionType;
  categoryName: string;
  sourceHash: string;
  raw: Record<string, unknown>;
};

export type ImportPreviewData = {
  bankName: string;
  detectedFormat: ImportBankFormat;
  fileName: string;
  movements: SerializedPreviewMovement[];
  rowCount: number;
  startDate: string | null;
  endDate: string | null;
  incomeTotal: number;
  expenseTotal: number;
  openingBalance: number | null;
  closingBalance: number | null;
  balanceDifference: number | null;
  validationStatus: ImportValidationStatus;
  confidence: ImportConfidence;
  messages: string[];
};

function isCaixaBankPdf(text: string) {
  return /\bIBAN:\s*ES\d{22}\b/i.test(text) && /Saldo disponible:/i.test(text) && /Concepto\s+Fecha\s+Importe\s+Saldo/i.test(text);
}

function isIngPdf(text: string) {
  return /\bING BANK\b/i.test(text) && /Certificado de Movimientos/i.test(text);
}

function isBbvaPdf(text: string) {
  return /\bBBVA\b|Banco Bilbao/i.test(text) && /saldo|concepto|importe/i.test(text);
}

function bankName(format: ImportBankFormat) {
  switch (format) {
    case "BBVA":
      return "BBVA";
    case "TRADE_REPUBLIC":
      return "Trade Republic";
    case "ING":
      return "ING";
    case "CAIXABANK":
      return "CaixaBank";
    default:
      return "Otros";
  }
}

function serializeMovement(movement: ParsedMovement): SerializedPreviewMovement {
  return {
    date: movement.date.toISOString(),
    concept: movement.concept,
    amount: Number(movement.amount),
    balance: movement.balance === null || Number.isNaN(movement.balance) ? null : Number(movement.balance),
    type: movement.type,
    categoryName: movement.categoryName,
    sourceHash: movement.sourceHash,
    raw: movement.raw
  };
}

export function deserializePreviewMovement(movement: SerializedPreviewMovement): ParsedMovement {
  return {
    date: new Date(movement.date),
    concept: movement.concept,
    amount: movement.amount,
    balance: movement.balance,
    type: movement.type,
    categoryName: movement.categoryName,
    sourceHash: movement.sourceHash,
    raw: Object.fromEntries(Object.entries(movement.raw ?? {}).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)]))
  };
}

function sumSigned(movements: ParsedMovement[]) {
  return movements.reduce((sum, movement) => sum + movement.amount, 0);
}

function balanceCandidate(movements: ParsedMovement[], direction: "asc" | "desc") {
  if (movements.length === 0) {
    return null;
  }

  const ordered = direction === "asc" ? movements : [...movements].reverse();
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (first.balance === null || last.balance === null) {
    return null;
  }

  const openingBalance = Number((first.balance - first.amount).toFixed(2));
  const closingBalance = Number(last.balance.toFixed(2));
  const expectedClosing = Number((openingBalance + sumSigned(ordered)).toFixed(2));
  const diff = Number((expectedClosing - closingBalance).toFixed(2));
  return { openingBalance, closingBalance, diff: Math.abs(diff), signedDiff: diff };
}

function validateBalances(movements: ParsedMovement[]) {
  const withBalances = movements.filter((movement) => movement.balance !== null && Number.isFinite(movement.balance));
  if (withBalances.length < 2) {
    return {
      openingBalance: null,
      closingBalance: withBalances[0]?.balance ?? null,
      balanceDifference: null,
      message: "El extracto no trae saldos suficientes para validar el saldo final."
    };
  }

  const asc = balanceCandidate(movements, "asc");
  const desc = balanceCandidate(movements, "desc");
  const selected = [asc, desc].filter(Boolean).sort((a, b) => a!.diff - b!.diff)[0];
  if (!selected) {
    return {
      openingBalance: null,
      closingBalance: null,
      balanceDifference: null,
      message: "No se ha podido validar el saldo del extracto."
    };
  }

  return {
    openingBalance: selected.openingBalance,
    closingBalance: selected.closingBalance,
    balanceDifference: selected.signedDiff,
    message: selected.diff <= 0.05 ? null : "Los movimientos detectados no cuadran con el saldo final del extracto. Revisa antes de importar."
  };
}

async function parseCsv(buffer: Buffer, forcedFormat: ImportBankFormat) {
  const text = buffer.toString("utf8");
  if (forcedFormat === "TRADE_REPUBLIC") {
    return { format: "TRADE_REPUBLIC" as const, movements: parseTradeRepublicCsv(text) };
  }

  if (forcedFormat === "BBVA") {
    return { format: "BBVA" as const, movements: parseBBVACsv(text) };
  }

  try {
    return { format: "TRADE_REPUBLIC" as const, movements: parseTradeRepublicCsv(text) };
  } catch {
    return { format: "BBVA" as const, movements: parseBBVACsv(text) };
  }
}

async function parsePdf(buffer: Buffer, forcedFormat: ImportBankFormat) {
  if (forcedFormat === "BBVA") {
    return { format: "BBVA" as const, movements: await parseBBVAPdf(buffer) };
  }

  const text = await extractPdfText(buffer);
  if (forcedFormat === "ING") {
    return { format: "ING" as const, movements: parseINGPdfText(text) };
  }
  if (forcedFormat === "CAIXABANK") {
    return { format: "CAIXABANK" as const, movements: parseCaixaBankPdfText(text) };
  }

  if (isIngPdf(text)) {
    return { format: "ING" as const, movements: parseINGPdfText(text) };
  }
  if (isCaixaBankPdf(text)) {
    return { format: "CAIXABANK" as const, movements: parseCaixaBankPdfText(text) };
  }
  if (isBbvaPdf(text)) {
    return { format: "BBVA" as const, movements: await parseBBVAPdf(buffer) };
  }

  throw new Error("Este formato todavia no esta soportado. No se ha guardado ningun movimiento.");
}

export async function analyzeImportFile({
  buffer,
  fileName,
  mimeType,
  forcedFormat = "AUTO"
}: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  forcedFormat?: ImportBankFormat;
}): Promise<ImportPreviewData> {
  const lowerName = fileName.toLowerCase();
  const isCsv = lowerName.endsWith(".csv") || mimeType === "text/csv";
  const isPdf = lowerName.endsWith(".pdf") || mimeType === "application/pdf";

  if (!isCsv && !isPdf) {
    throw new Error("El archivo debe ser CSV o PDF.");
  }
  if (forcedFormat === "UNSUPPORTED") {
    throw new Error("Este formato todavia no esta soportado. No se ha guardado ningun movimiento.");
  }

  const parsed = isCsv ? await parseCsv(buffer, forcedFormat) : await parsePdf(buffer, forcedFormat);
  const movements = parsed.movements;
  if (movements.length === 0) {
    throw new Error("El archivo no contiene movimientos detectables. No se ha guardado ningun movimiento.");
  }

  const dates = movements.map((movement) => movement.date.getTime()).filter(Number.isFinite);
  const incomeTotal = movements.filter((movement) => movement.amount > 0).reduce((sum, movement) => sum + Math.abs(movement.amount), 0);
  const expenseTotal = movements.filter((movement) => movement.amount < 0).reduce((sum, movement) => sum + Math.abs(movement.amount), 0);
  const balance = validateBalances(movements);
  const messages = [balance.message].filter((message): message is string => Boolean(message));

  const validationStatus: ImportValidationStatus = messages.length === 0 ? "correcto" : "aviso";
  const confidence: ImportConfidence = validationStatus === "correcto"
    ? "alta"
    : balance.balanceDifference === null
      ? "media"
      : "baja";

  return {
    bankName: bankName(parsed.format),
    detectedFormat: parsed.format,
    fileName,
    movements: movements.map(serializeMovement),
    rowCount: movements.length,
    startDate: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    endDate: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
    incomeTotal: Number(incomeTotal.toFixed(2)),
    expenseTotal: Number(expenseTotal.toFixed(2)),
    openingBalance: balance.openingBalance,
    closingBalance: balance.closingBalance,
    balanceDifference: balance.balanceDifference,
    validationStatus,
    confidence,
    messages
  };
}