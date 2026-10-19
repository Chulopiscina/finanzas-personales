import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPdfText, isBBVAPdfText, parseBBVAPdfText } from "@/lib/pdf";
import { analyzeImportFile, deserializePreviewMovement, extractDeclaredBalances, validateBalances } from "@/lib/import-preview";
import { planImport } from "@/lib/import-identity";

vi.mock("@/lib/pdf", async (original) => ({
  ...await original<typeof import("@/lib/pdf")>(),
  extractPdfText: vi.fn()
}));

const money = (amount: number) => (amount / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Synthetic transactions, not the customer's bank data. Reproduces pdf-parse's
// page order: the footer balance can precede the opening balance and all rows.
function monthlyFixture() {
  const amounts = [...Array<number>(30).fill(-1000), -2000, ...Array<number>(7).fill(-3000), 10000, -4480];
  let balance = 166154;
  const rows = amounts.map((amount, index) => {
    balance += amount;
    const day = String(Math.min(index + 1, 31)).padStart(2, "0");
    return `${day}/07 ${day}/07 ${amount > 0 ? "ABONO DE NOMINA POR TRANSFERENCIA" : "PAGO CON TARJETA EN SUPERMERCADOS"}\nCOMERCIO DE PRUEBA ${index + 1}\n${money(amount)} ${money(balance)}`;
  });
  const page = (number: number, opening: number, closing: number, records: string[]) => [
    "Titulares:", "EXTRACTO MENSUAL DE CUENTAS PERSONALES",
    "F.Oper. Concepto\tF.Valor Importe", "SALDO A NUESTRO FAVOR SALDO A SU FAVOR",
    "HOJA", "Fecha de emisión:", "Saldo", "Todos los importes de este extracto se expresan en:",
    "F00201", "BIC:", "TITULAR FICTICIO", "EURO", "EXTRACTO DE JULIO 2026 01/08/2026",
    `${number}\tIBAN ES00 0182 0000 0000 0000 0000`, money(closing),
    `SALDO ANTERIOR - - - - - - - - - - - ${money(opening)}`,
    ...records, "S6000000000000000000000000000P", `-- ${number} of 2 --`
  ].join("\n");
  return { text: page(1, 166154, 134154, rows.slice(0, 31)) + "\n" + page(2, 134154, 118674, rows.slice(31)), amounts };
}

afterEach(() => vi.mocked(extractPdfText).mockReset());

describe("BBVA mensual sin logo extraíble", () => {
  it("detecta el banco por código y estructura, sin aceptar cualquier extracto o mención", () => {
    const { text } = monthlyFixture();
    expect(text).not.toContain("BBVA");
    expect(isBBVAPdfText(text)).toBe(true);
    expect(isBBVAPdfText(text.replaceAll("0182", "1465"))).toBe(false);
    expect(isBBVAPdfText(text.replaceAll("EXTRACTO MENSUAL DE CUENTAS PERSONALES", "FACTURA"))).toBe(false);
    expect(isBBVAPdfText("IBAN ES00 0182 0000 0000 0000 0000\nSaldo 100,00")).toBe(false);
    expect(isBBVAPdfText("BBVA 01/06/2026 Concepto Importe Saldo")).toBe(true);
  });

  it("lee 40 filas, no usa los saldos de página como importes y conserva conceptos y signos", () => {
    const { text, amounts } = monthlyFixture();
    const rows = parseBBVAPdfText(text);
    expect(rows).toHaveLength(40);
    expect(rows.map((row) => Math.round(row.amount * 100))).toEqual(amounts);
    expect(rows.every((row) => row.date.getUTCMonth() === 6 && row.date.getUTCFullYear() === 2026)).toBe(true);
    expect(rows.every((row, index) => row.concept.includes(`COMERCIO DE PRUEBA ${index + 1}`))).toBe(true);
    expect(rows.every((row) => !/S60000|SALDO ANTERIOR|EXTRACTO|TITULAR|IBAN|of 2/.test(row.concept))).toBe(true);
    const balance = validateBalances(rows, extractDeclaredBalances(text));
    expect(balance.openingBalance).toBe(1661.54);
    expect(balance.closingBalance).toBe(1186.74);
    expect(balance.balanceDifference).toBe(0);
    expect(balance.message).not.toMatch(/no cuadran/);
    expect(rows[38]).toMatchObject({ type: "INCOME", categoryName: "Nómina" });
    expect(planImport(rows, planImport(rows, []).inserts).duplicates).toBe(40);
  });

  it("pasa por detección automática y vista previa sin forzar BBVA ni guardar movimientos", async () => {
    vi.mocked(extractPdfText).mockResolvedValue(monthlyFixture().text);
    const preview = await analyzeImportFile({ buffer: Buffer.from("synthetic"), fileName: "juliol.pdf", mimeType: "application/pdf", forcedFormat: "AUTO" });
    expect(preview).toMatchObject({ detectedFormat: "BBVA", rowCount: 40, openingBalance: 1661.54, closingBalance: 1186.74, balanceDifference: 0, incomeTotal: 100, expenseTotal: 574.8 });
    expect(preview.movements.map(deserializePreviewMovement)).toHaveLength(40);
  });

  it("sigue rechazando formatos no identificados", async () => {
    vi.mocked(extractPdfText).mockResolvedValue(monthlyFixture().text.replaceAll("0182", "1465"));
    await expect(analyzeImportFile({ buffer: Buffer.from("synthetic"), fileName: "otro.pdf", mimeType: "application/pdf", forcedFormat: "AUTO" })).rejects.toThrow(/no esta soportado/);
  });

  it("no sustituye una fila incompleta con el saldo del pie de página siguiente", () => {
    const { text } = monthlyFixture();
    const truncated = text.replace(`${money(-2000)} ${money(134154)}`, money(134154));
    expect(truncated).not.toBe(text);
    expect(() => parseBBVAPdfText(truncated)).toThrow(/Falta el importe/);
  });

  it("no interpreta el separador como signo ni el saldo de página 2 como saldo inicial", () => {
    expect(extractDeclaredBalances(monthlyFixture().text).opening).toBe(1661.54);
    expect(extractDeclaredBalances("Saldo anterior --------------------- 1.661,54").opening).toBe(1661.54);
    expect(extractDeclaredBalances("Saldo anterior - - - - - -50,00").opening).toBe(-50);
    expect(extractDeclaredBalances("Saldo anterior ----- -50,00").opening).toBe(-50);
    expect(extractDeclaredBalances("Saldo anterior: -50,00").opening).toBe(-50);
  });
});

// Opt-in local verification: never commits or logs the customer's PDF/content.
it.skipIf(!process.env.BBVA_REGRESSION_PDF)("verifica el PDF privado de julio de 2026 con extracción real", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf")>("@/lib/pdf");
  const buffer = readFileSync(process.env.BBVA_REGRESSION_PDF!);
  const text = await actual.extractPdfText(buffer);
  vi.mocked(extractPdfText).mockResolvedValue(text);
  const preview = await analyzeImportFile({ buffer, fileName: "juliol.pdf", mimeType: "application/pdf", forcedFormat: "AUTO" });
  expect(preview).toMatchObject({ detectedFormat: "BBVA", rowCount: 40, openingBalance: 1661.54, closingBalance: 1186.74, balanceDifference: 0 });
  expect(preview.startDate).toBe("2026-07-01T00:00:00.000Z");
  expect(preview.endDate).toBe("2026-07-31T00:00:00.000Z");
  expect(preview.messages.join(" ")).not.toContain("no cuadran");
  const rows = preview.movements.map(deserializePreviewMovement);
  expect(planImport(rows, planImport(rows, []).inserts).duplicates).toBe(40);
  expect(new Set(rows.map((row) => row.sourceHash)).size).toBe(40);
  expect(rows.every((row) => !/S60000|SALDO ANTERIOR|EXTRACTO|IBAN|of 2/.test(row.concept))).toBe(true);
});
