import { InputError } from "@/lib/input-error";
import { TransactionType } from "@prisma/client";
import { parseBBVACsv, parseTradeRepublicCsv, type ParsedMovement } from "@/lib/csv";
import { extractPdfText, parseBBVAPdfText, parseCaixaBankPdfText, parseINGPdfText } from "@/lib/pdf";
import { cents, sumMoney, addMoney } from "@/lib/money";
import { parseSpanishAmount } from "@/lib/csv";
import { cleanBankDescription } from "@/lib/bank-text";
import { decodeBankCsv } from "@/lib/import-file";

export type ImportBankFormat = "AUTO" | "BBVA" | "TRADE_REPUBLIC" | "ING" | "CAIXABANK" | "UNSUPPORTED";
export type ImportValidationStatus = "correcto" | "aviso" | "error";
export type ImportConfidence = "alta" | "media" | "baja";

export type SerializedPreviewMovement = {
  date: string;
  concept: string;
  cleanDescription?: string;
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
    cleanDescription: movement.cleanDescription ?? cleanBankDescription(movement.concept),
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
    cleanDescription: movement.cleanDescription ?? cleanBankDescription(movement.concept),
    amount: movement.amount,
    balance: movement.balance,
    type: movement.type,
    categoryName: movement.categoryName,
    sourceHash: movement.sourceHash,
    raw: Object.fromEntries(Object.entries(movement.raw ?? {}).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)]))
  };
}

export function extractDeclaredBalances(text: string) {
  const find = (pattern: RegExp, last = false) => {
    const matches = [...text.matchAll(pattern)];
    const value = (last ? matches.at(-1) : matches[0])?.[1];
    const amount = value ? parseSpanishAmount(value) : NaN;
    return Number.isFinite(amount) ? amount : null;
  };
  return {
    opening: find(/(?:saldo\s+(?:inicial|anterior)|opening\s+balance|initial\s+balance)\s*:?\s*([-+]?\d[\d.,]*\d)/gi),
    closing: find(/(?:saldo\s+(?:final|actual|disponible)|closing\s+balance|final\s+balance)\s*:?\s*([-+]?\d[\d.,]*\d)/gi, true)
  };
}

export function validateBalances(movements: ParsedMovement[], declared = { opening: null as number | null, closing: null as number | null }) {
  const candidates = [movements, [...movements].reverse()].filter((ordered) => ordered.every((movement, index) => index === 0 || movement.date >= ordered[index - 1].date));
  const assessed = candidates.map((ordered) => {
    const first = ordered[0];
    const opening = declared.opening ?? (first?.balance == null ? null : addMoney(first.balance, -first.amount));
    let running = opening;
    let mismatches = 0;
    for (const movement of ordered) {
      if (running !== null) running = addMoney(running, movement.amount);
      if (movement.balance !== null) {
        if (running !== null && cents(running) !== cents(movement.balance)) mismatches++;
        running = movement.balance;
      }
    }
    const closing = declared.closing ?? ordered.at(-1)?.balance ?? null;
    const difference = opening !== null && closing !== null ? addMoney(opening, sumMoney(movements, (m) => m.amount), -closing) : null;
    return { opening, closing, difference, mismatches, ordered };
  }).sort((a, b) => a.mismatches - b.mismatches);
  const selected = assessed[0];
  const invalid = !selected || selected.mismatches > 0 || (selected.difference !== null && cents(selected.difference) !== 0);
  const independent = declared.opening !== null && declared.closing !== null;
  return {
    openingBalance: selected?.opening ?? declared.opening,
    closingBalance: selected?.closing ?? declared.closing,
    balanceDifference: selected?.difference ?? null,
    ordered: selected?.ordered ?? [...movements].sort((a, b) => a.date.getTime() - b.date.getTime()),
    message: invalid ? "Los movimientos detectados no cuadran con el saldo final del extracto. Revisa antes de importar."
      : !independent ? "Los saldos son inferidos o incompletos: no se han podido contrastar ambos saldos declarados del extracto." : null
  };
}

async function parseCsv(buffer: Buffer, forcedFormat: ImportBankFormat) {
  const text = decodeBankCsv(buffer);
  if (forcedFormat === "TRADE_REPUBLIC") {
    return { format: "TRADE_REPUBLIC" as const, movements: parseTradeRepublicCsv(text) };
  }

  if (["BBVA", "ING", "CAIXABANK"].includes(forcedFormat)) {
    return { format: forcedFormat, movements: parseBBVACsv(text) };
  }

  try {
    return { format: "TRADE_REPUBLIC" as const, movements: parseTradeRepublicCsv(text) };
  } catch {
    return { format: "BBVA" as const, movements: parseBBVACsv(text) };
  }
}

async function parsePdf(buffer: Buffer, forcedFormat: ImportBankFormat) {
  const text = await extractPdfText(buffer);
  if (forcedFormat === "BBVA") {
    return { format: "BBVA" as const, movements: parseBBVAPdfText(text), text };
  }

  if (forcedFormat === "ING") {
    return { format: "ING" as const, movements: parseINGPdfText(text), text };
  }
  if (forcedFormat === "CAIXABANK") {
    return { format: "CAIXABANK" as const, movements: parseCaixaBankPdfText(text), text };
  }

  if (isIngPdf(text)) {
    return { format: "ING" as const, movements: parseINGPdfText(text), text };
  }
  if (isCaixaBankPdf(text)) {
    return { format: "CAIXABANK" as const, movements: parseCaixaBankPdfText(text), text };
  }
  if (isBbvaPdf(text)) {
    return { format: "BBVA" as const, movements: parseBBVAPdfText(text), text };
  }

  throw new InputError("Este formato todavia no esta soportado. No se ha guardado ningun movimiento.");
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
    throw new InputError("El archivo debe ser CSV o PDF.");
  }
  if (forcedFormat === "UNSUPPORTED") {
    throw new InputError("Este formato todavia no esta soportado. No se ha guardado ningun movimiento.");
  }

  const parsed = isCsv ? await parseCsv(buffer, forcedFormat) : await parsePdf(buffer, forcedFormat);
  const movements = parsed.movements;
  if (movements.length > 5000) throw new InputError("El extracto supera los 5.000 movimientos. Divídelo en periodos más pequeños.");
  if (movements.length === 0) {
    throw new InputError("El archivo no contiene movimientos detectables. No se ha guardado ningun movimiento.");
  }

  const dates = movements.map((movement) => movement.date.getTime()).filter(Number.isFinite);
  const incomeTotal = sumMoney(movements.filter((movement) => movement.amount > 0), (movement) => movement.amount);
  const expenseTotal = sumMoney(movements.filter((movement) => movement.amount < 0), (movement) => -movement.amount);
  const declared = extractDeclaredBalances("text" in parsed ? String(parsed.text) : "");
  const balance = validateBalances(movements, declared);
  const messages = [balance.message].filter((message): message is string => Boolean(message));
  const unverifiedCsvBank = isCsv && forcedFormat === "AUTO" && parsed.format === "BBVA";
  if (unverifiedCsvBank) messages.push("El CSV tiene columnas compatibles, pero el banco no se puede verificar. Selecciona el formato o confirma expresamente la revisión.");

  const validationStatus: ImportValidationStatus = messages.length === 0 ? "correcto" : "aviso";
  const confidence: ImportConfidence = unverifiedCsvBank ? "baja" : validationStatus === "correcto"
    ? "alta"
    : balance.balanceDifference === null
      ? "media"
      : "baja";

  return {
    bankName: unverifiedCsvBank ? "CSV compatible (banco no verificado)" : bankName(parsed.format),
    detectedFormat: parsed.format,
    fileName,
    movements: balance.ordered.map((movement, index) => serializeMovement({ ...movement, raw: { ...movement.raw, statementSequence: String(index) } })),
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
