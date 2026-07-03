import { classify, hashValue, parseSpanishAmount, parseSpanishDate, type ParsedMovement } from "@/lib/csv";

type PdfStatementContext = {
  year: number | null;
  statementMonth: number | null;
};

const fullDatePattern = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;
const fullDateAtStartPattern = /^\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
const shortDateRowPattern = /^\s*(\d{1,2})[/-](\d{1,2})\s+(\d{1,2})[/-](\d{1,2})\b/;
const moneyPattern = /[-+]?\d{1,3}(?:\.\d{3})*,\d{2}-?|[-+]?\d+,\d{2}-?|[-+]?\d+\.\d{2}-?/g;
const moneyWithCurrencyPattern = /[-+]?\d{1,3}(?:\.\d{3})*,\d{2}\s*\u20ac|-?\d+,\d{2}\s*\u20ac|[-+]?\d+\.\d{2}\s*\u20ac/g;
const pdfNoiseLinePattern =
  /^(?:saldo\s+(?:anterior|inicial|final|actual|disponible)|total(?:es)?\b|resumen\b|extracto\b|titulares:?\b|f\.oper\b|fecha\s+de\s+emisi[o\u00f3]n\b|todos\s+los\s+importes\b|hoja\b|bic:?\b|euro\b|iban\b|--\s*\d+\s+of\s+\d+\s*--|S\d{6,}\b|F\d{5,}\b|BBVA\b|Banco Bilbao\b|www\.bbva\b|Atenci[o\u00f3]n\b)/i;
const pdfNoiseInlinePattern =
  /\s+(?:saldo\s+(?:anterior|inicial|final|actual|disponible)|total(?:es)?\b|resumen\b|extracto\b|titulares:?\b|f\.oper\b|fecha\s+de\s+emisi[o\u00f3]n\b|todos\s+los\s+importes\b|hoja\b|bic:?\b|euro\b|iban\b|--\s*\d+\s+of\s+\d+\s*--|S\d{6,}\b|F\d{5,}\b|BBVA\b|Banco Bilbao\b|www\.bbva\b|Atenci[o\u00f3]n\b).*/i;

async function ensurePdfRuntime() {
  const globalWithDom = globalThis as Record<string, unknown>;

  if (!globalWithDom.DOMMatrix || !globalWithDom.DOMPoint || !globalWithDom.DOMRect || !globalWithDom.ImageData) {
    const canvas = await import("@napi-rs/canvas");
    globalWithDom.DOMMatrix ??= canvas.DOMMatrix;
    globalWithDom.DOMPoint ??= canvas.DOMPoint;
    globalWithDom.DOMRect ??= canvas.DOMRect;
    globalWithDom.ImageData ??= canvas.ImageData;
    globalWithDom.Path2D ??= canvas.Path2D;
  }

  if (!globalWithDom.pdfjsWorker) {
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    globalWithDom.pdfjsWorker = { WorkerMessageHandler: worker.WorkerMessageHandler };
  }
}

function normalizeLine(line: string) {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizePdfText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\s+(?=\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b)/g, "\n")
    .replace(/\s+(?=\d{1,2}[/-]\d{1,2}\s+\d{1,2}[/-]\d{1,2}\b)/g, "\n")
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean);
}

function isMovementStart(line: string) {
  if (shortDateRowPattern.test(line)) {
    return true;
  }

  const fullDateAtStart = line.match(fullDateAtStartPattern);
  return Boolean(fullDateAtStart && line.slice(fullDateAtStart[0].length).trim().length > 0);
}

function isPdfNoiseLine(line: string) {
  const normalized = normalizeLine(line);
  return !normalized || pdfNoiseLinePattern.test(normalized);
}

function buildRecords(lines: string[]) {
  const records: string[] = [];
  let current = "";

  for (const line of lines) {
    if (isPdfNoiseLine(line)) {
      if (current) {
        records.push(current);
        current = "";
      }
      continue;
    }

    if (isMovementStart(line)) {
      if (current) {
        records.push(current);
      }
      current = line;
      continue;
    }

    if (current) {
      current = `${current} ${line}`;
    }
  }

  if (current) {
    records.push(current);
  }

  return records;
}

function trimPdfRecord(record: string) {
  return record.replace(pdfNoiseInlinePattern, "").trim();
}

function getStatementContext(text: string): PdfStatementContext {
  const fullDates = [...text.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g)]
    .map((match) => {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const rawYear = match[3];
      const year = Number(rawYear.length === 2 ? `20${rawYear}` : rawYear);
      const date = new Date(Date.UTC(year, month - 1, day));

      return {
        day,
        month,
        year,
        valid:
          year >= 2000 &&
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31 &&
          date.getUTCFullYear() === year &&
          date.getUTCMonth() === month - 1 &&
          date.getUTCDate() === day
      };
    })
    .filter((date) => date.valid);

  const firstDate = fullDates[0];
  if (firstDate) {
    return { year: firstDate.year, statementMonth: firstDate.month };
  }

  const yearMatch = text.match(/\b(20\d{2})\b/);
  return yearMatch ? { year: Number(yearMatch[1]), statementMonth: null } : { year: null, statementMonth: null };
}

function inferYear(month: number, context: PdfStatementContext) {
  if (!context.year) {
    return null;
  }

  if (context.statementMonth !== null && context.statementMonth <= 2 && month >= 11) {
    return context.year - 1;
  }

  return context.year;
}

function buildDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Fecha invalida en el PDF: ${day}/${month}/${year}`);
  }

  return date;
}

function parsePdfDate(record: string, context: PdfStatementContext) {
  const shortRow = record.match(shortDateRowPattern);
  if (shortRow) {
    const day = Number(shortRow[1]);
    const month = Number(shortRow[2]);
    const year = inferYear(month, context);

    if (!year) {
      throw new Error("No he podido detectar el ano del extracto PDF.");
    }

    return {
      date: buildDate(year, month, day),
      rest: record.slice(shortRow[0].length).trim()
    };
  }

  const fullDateMatch = record.match(fullDatePattern);
  if (!fullDateMatch || fullDateMatch.index === undefined) {
    return null;
  }

  let rest = record.slice(fullDateMatch.index + fullDateMatch[0].length).trim();
  rest = rest.replace(/^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\s+/, "").trim();

  return { date: parseSpanishDate(fullDateMatch[0]), rest };
}

function movementHash(date: Date, concept: string, amount: number, balance: number | null, source: string) {
  return hashValue([
    source,
    date.toISOString().slice(0, 10),
    concept.toLowerCase().replace(/\s+/g, " ").trim(),
    amount.toFixed(2),
    balance === null || Number.isNaN(balance) ? "" : balance.toFixed(2)
  ].join("|"));
}

function parsePdfRecord(record: string, index: number, context: PdfStatementContext): ParsedMovement | null {
  const cleanRecord = trimPdfRecord(record);
  const parsedDate = parsePdfDate(cleanRecord, context);
  if (!parsedDate) {
    return null;
  }

  const { date, rest } = parsedDate;
  const moneyMatches = [...rest.matchAll(moneyPattern)];
  if (moneyMatches.length === 0) {
    return null;
  }

  const amountMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 2] : moneyMatches[0];
  const balanceMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 1] : null;

  if (amountMatch.index === undefined) {
    return null;
  }

  const concept = rest.slice(0, amountMatch.index).replace(/\s+/g, " ").trim();
  if (!concept || concept.length < 2) {
    return null;
  }

  const amount = parseSpanishAmount(amountMatch[0]);
  const balance = balanceMatch ? parseSpanishAmount(balanceMatch[0]) : null;

  if (!Number.isFinite(amount)) {
    throw new Error(`Importe invalido en el movimiento PDF ${index + 1}.`);
  }

  const classification = classify(concept, amount);

  return {
    date,
    concept,
    amount,
    balance: balance === null || Number.isNaN(balance) ? null : balance,
    type: classification.type,
    categoryName: classification.categoryName,
    sourceHash: movementHash(date, concept, amount, balance, "pdf"),
    raw: {
      source: "pdf",
      record: cleanRecord,
      extractedAt: new Date().toISOString()
    }
  };
}

function isCaixaBankPdf(text: string) {
  return /\bIBAN:\s*ES\d{22}\b/i.test(text) && /Saldo disponible:/i.test(text) && /Concepto\s+Fecha\s+Importe\s+Saldo/i.test(text);
}

function parseCaixaBankRecord(line: string, index: number): ParsedMovement | null {
  const normalized = normalizeLine(line);
  if (/^(?:IBAN:|Periodo:|Concepto\s+Fecha\s+Importe\s+Saldo|\d+\/\d+|--\s*\d+\s+of\s+\d+\s*--)/i.test(normalized)) {
    return null;
  }

  const rowMatch = normalized.match(/^(.+?)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{4})\s+([-+]?\d{1,3}(?:\.\d{3})*,\d{2}|[-+]?\d+,\d{2})\s*€\s+([-+]?\d{1,3}(?:\.\d{3})*,\d{2}|[-+]?\d+,\d{2})\s*€$/i);
  if (!rowMatch) {
    return null;
  }

  const concept = rowMatch[1].replace(/\s+/g, " ").trim();
  const date = parseSpanishDate(rowMatch[2]);
  const amount = parseSpanishAmount(rowMatch[3]);
  const balance = parseSpanishAmount(rowMatch[4]);

  if (!concept || !Number.isFinite(amount)) {
    throw new Error(`Importe invalido en el movimiento CaixaBank ${index + 1}.`);
  }

  const classification = classify(concept, amount);
  const type = /\bbizum\s+rebut\b/i.test(concept) && amount > 0 ? "INCOME" : classification.type;

  return {
    date,
    concept,
    amount,
    balance: Number.isFinite(balance) ? balance : null,
    type,
    categoryName: classification.categoryName,
    sourceHash: movementHash(date, concept, amount, Number.isFinite(balance) ? balance : null, "caixabank-pdf"),
    raw: {
      source: "caixabank-pdf",
      record: line,
      extractedAt: new Date().toISOString()
    }
  } satisfies ParsedMovement;
}

export function parseCaixaBankPdfText(text: string) {
  const lines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const movements = lines
    .map((line, index) => parseCaixaBankRecord(line, index))
    .filter((movement): movement is ParsedMovement => movement !== null);

  if (movements.length === 0) {
    throw new Error("No he podido detectar movimientos en el PDF de CaixaBank. Debe contener columnas Concepto, Fecha, Importe y Saldo.");
  }

  return movements;
}
function isIngPdf(text: string) {
  return /\bING BANK\b/i.test(text) && /Certificado de Movimientos/i.test(text);
}

function parseINGRecord(line: string, index: number): ParsedMovement | null {
  const normalized = normalizeLine(line);
  const rowMatch = normalized.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{4})\s+(.+?)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{4})\s+(.+)$/);
  if (!rowMatch) {
    return null;
  }

  const date = parseSpanishDate(rowMatch[1]);
  const concept = rowMatch[2].replace(/\s+/g, " ").trim();
  const tail = rowMatch[4];
  const moneyMatches = [...tail.matchAll(moneyWithCurrencyPattern)];

  if (moneyMatches.length < 2 || !concept) {
    return null;
  }

  const balance = parseSpanishAmount(moneyMatches[moneyMatches.length - 2][0]);
  const amount = parseSpanishAmount(moneyMatches[moneyMatches.length - 1][0]);

  if (!Number.isFinite(amount)) {
    throw new Error(`Importe invalido en el movimiento ING ${index + 1}.`);
  }

  const classification = classify(concept, amount);
  return {
    date,
    concept,
    amount,
    balance: Number.isFinite(balance) ? balance : null,
    type: classification.type,
    categoryName: classification.categoryName,
    sourceHash: movementHash(date, concept, amount, Number.isFinite(balance) ? balance : null, "ing-pdf"),
    raw: {
      source: "ing-pdf",
      record: line,
      valueDate: rowMatch[3],
      extractedAt: new Date().toISOString()
    }
  };
}

export async function extractPdfText(buffer: Buffer) {
  await ensurePdfRuntime();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export function parseINGPdfText(text: string) {
  const lines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const movements = lines
    .map((line, index) => parseINGRecord(line, index))
    .filter((movement): movement is ParsedMovement => movement !== null);

  if (movements.length === 0) {
    throw new Error("No he podido detectar movimientos en el PDF de ING. Debe contener filas con fecha, concepto, saldo e importe.");
  }

  return movements;
}

export async function parseBBVAPdf(buffer: Buffer) {
  const text = await extractPdfText(buffer);
  const lines = normalizePdfText(text);

  if (lines.length === 0) {
    throw new Error("El PDF no contiene texto extraible. Si es una imagen escaneada, hace falta OCR.");
  }

  const context = getStatementContext(text);
  const records = buildRecords(lines);
  const movements = records
    .map((record, index) => parsePdfRecord(record, index, context))
    .filter((movement): movement is ParsedMovement => movement !== null);

  if (movements.length === 0) {
    throw new Error(
      "No he podido detectar movimientos en el PDF. Debe contener filas con fecha, concepto, importe y saldo."
    );
  }

  return movements;
}

export async function parseBankPdf(buffer: Buffer) {
  const text = await extractPdfText(buffer);
  if (isIngPdf(text)) {
    return parseINGPdfText(text);
  }

  if (isCaixaBankPdf(text)) {
    return parseCaixaBankPdfText(text);
  }

  const lines = normalizePdfText(text);
  if (lines.length === 0) {
    throw new Error("El PDF no contiene texto extraible. Si es una imagen escaneada, hace falta OCR.");
  }

  const context = getStatementContext(text);
  const records = buildRecords(lines);
  const movements = records
    .map((record, index) => parsePdfRecord(record, index, context))
    .filter((movement): movement is ParsedMovement => movement !== null);

  if (movements.length === 0) {
    throw new Error("No he podido detectar movimientos en el PDF. Debe contener filas con fecha, concepto, importe y saldo.");
  }

  return movements;
}
