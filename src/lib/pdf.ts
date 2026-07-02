import { classify, hashValue, parseSpanishAmount, parseSpanishDate, type ParsedMovement } from "@/lib/csv";

type PdfStatementContext = {
  year: number | null;
  statementMonth: number | null;
};

const fullDatePattern = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;
const fullDateAtStartPattern = /^\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
const shortDateRowPattern = /^\s*(\d{1,2})[/-](\d{1,2})\s+(\d{1,2})[/-](\d{1,2})\b/;
const moneyPattern = /[-+]?\d{1,3}(?:\.\d{3})*,\d{2}-?|[-+]?\d+,\d{2}-?|[-+]?\d+\.\d{2}-?/g;

function normalizePdfText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\s+(?=\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b)/g, "\n")
    .replace(/\s+(?=\d{1,2}[/-]\d{1,2}\s+\d{1,2}[/-]\d{1,2}\b)/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isMovementStart(line: string) {
  if (shortDateRowPattern.test(line)) {
    return true;
  }

  const fullDateAtStart = line.match(fullDateAtStartPattern);
  return Boolean(fullDateAtStart && line.slice(fullDateAtStart[0].length).trim().length > 0);
}

function buildRecords(lines: string[]) {
  const records: string[] = [];
  let current = "";

  for (const line of lines) {
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

function parsePdfRecord(record: string, index: number, context: PdfStatementContext): ParsedMovement | null {
  const parsedDate = parsePdfDate(record, context);
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
    raw: {
      source: "pdf",
      record,
      extractedAt: new Date().toISOString()
    }
  };
}

export async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
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
