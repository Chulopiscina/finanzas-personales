import { PDFParse } from "pdf-parse";
import { classify, hashValue, parseSpanishAmount, parseSpanishDate, type ParsedMovement } from "@/lib/csv";

const datePattern = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;
const moneyPattern = /[-+]?\d{1,3}(?:\.\d{3})*,\d{2}-?|[-+]?\d+,\d{2}-?|[-+]?\d+\.\d{2}-?/g;

function normalizePdfText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\s+(?=\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b)/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function buildRecords(lines: string[]) {
  const records: string[] = [];
  let current = "";

  for (const line of lines) {
    if (datePattern.test(line)) {
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

function parsePdfRecord(record: string, index: number): ParsedMovement | null {
  const dateMatch = record.match(datePattern);
  if (!dateMatch || dateMatch.index === undefined) {
    return null;
  }

  let rest = record.slice(dateMatch.index + dateMatch[0].length).trim();
  const secondDateMatch = rest.match(datePattern);
  if (secondDateMatch?.index === 0) {
    rest = rest.slice(secondDateMatch[0].length).trim();
  }

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

  const date = parseSpanishDate(dateMatch[0]);
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

  const records = buildRecords(lines);
  const movements = records
    .map((record, index) => parsePdfRecord(record, index))
    .filter((movement): movement is ParsedMovement => movement !== null);

  if (movements.length === 0) {
    throw new Error(
      "No he podido detectar movimientos en el PDF. Debe contener filas con fecha, concepto, importe y saldo."
    );
  }

  return movements;
}
