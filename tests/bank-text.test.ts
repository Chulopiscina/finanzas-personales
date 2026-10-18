import { describe, expect, it } from "vitest";
import { bankText, cleanBankDescription } from "@/lib/bank-text";
import { classify, parseBBVACsv, parseSpanishAmount } from "@/lib/csv";
import { analyzeImportFile, deserializePreviewMovement, extractDeclaredBalances } from "@/lib/import-preview";
import { decodeBankCsv, originalFile, storeOriginalFile } from "@/lib/import-file";
import { interpretNotification } from "@/lib/bank-notification";

describe("evidencia bancaria multilingüe", () => {
  it.each([
    ["Transferència NÒMINES", 1500, "Nómina"], ["ABONO DE NÓMINA", 1500, "Nómina"], ["SALARY payment", 1500, "Nómina"],
    ["Pagament amb targeta SUPERMERCAT", -30, "Supermercado"], ["Card purchase GROCERY", -30, "Supermercado"],
    ["BENZINERA", -30, "Gasolina"], ["PETROL STATION", -30, "Gasolina"], ["FARMÀCIA", -30, "Salud"],
    ["Transferència LLOGUER", -500, "Vivienda"], ["APPLE.COM/BILL", -10, "Suscripciones"]
  ])("clasifica %s sin cambiar el signo", (description, amount, category) => {
    const result = classify(description as string, amount as number);
    expect(result.categoryName).toBe(category);
    expect(result.type).toBe((amount as number) < 0 ? "EXPENSE" : "INCOME");
  });
  it.each([["1.234,56", 1234.56], ["1,234.56", 1234.56], ["(290,00 €)", -290], ["290,00-", -290], ["−12,50", -12.5], ["1000.23", 1000.23]])("lee importe %s", (value, expected) => expect(parseSpanishAmount(value as string)).toBe(expected));
  it.each(["1,2,3", "12 euros inventados", "USD 12.00", "1.23.45", "12,3456", "--12", "NaN", "10000000000", "1EUR2", "12 34", "(+12,00)"])("rechaza importe dudoso %s", (value) => expect(parseSpanishAmount(value)).toBeNaN());
  it("admite columnas catalanas e inglesas y preserva el original", () => {
    const original = "Pagament amb targeta SUPERMERCAT";
    const row = parseBBVACsv(`Data;Concepte;Import;Saldo\n19/06/2026;${original};-20,00;80,00`)[0];
    expect(row.concept).toBe(original); expect(row.cleanDescription).toBe("SUPERMERCAT");
    expect(row.raw.Concepte).toBe(original);
    expect(parseBBVACsv("Booking date,Description,Amount,Running balance\n2026-06-19,SALARY,1400.00,1500.00")[0].categoryName).toBe("Nómina");
    expect(bankText("NÒMINES")).toBe("nomines");
    expect(cleanBankDescription(original)).toBe("SUPERMERCAT");
  });
  it("no convierte divisas ni descarta saldos ilegibles", () => {
    expect(() => parseBBVACsv("Date,Description,Amount,Currency\n2026-06-19,Test,12.00,USD")).toThrow(/Moneda/);
    expect(() => parseBBVACsv("Data;Concepte;Import;Saldo\n19/06/2026;Test;-20,00;ilegible")).toThrow();
    expect(() => parseBBVACsv("Date,Description,Amount,Status\n2026-06-19,Card payment,-10.00,Pending")).toThrow(/pendiente/);
    expect(classify("Ingrés efectiu NÒMINES", 100).categoryName).not.toBe("Nómina");
    expect(classify("BIZUM NOMINA", 100).categoryName).not.toBe("Nómina");
  });
  it("utiliza sectores explícitos del CSV sin inventar objetivos ni gasto fijo", () => {
    const row = parseBBVACsv("Data d'operació;Concepte;Import EUR;Sector\n19/06/2026;COMERCIO SIN NOMBRE;-20,00;GASOLINERAS")[0];
    expect(row.categoryName).toBe("Gasolina"); expect(row.concept).toBe("COMERCIO SIN NOMBRE");
    expect(row).not.toHaveProperty("isFixedExpense"); expect(row).not.toHaveProperty("goalId");
  });
  it("conserva byte a byte CSV antiguos/no UTF8 y descarga formatos anteriores", () => {
    const buffer = Buffer.from("Fecha;Concepto;Importe\n19/06/2026;N\xf3mina;1400,00", "latin1");
    expect(decodeBankCsv(buffer)).toContain("Nómina");
    expect(originalFile(storeOriginalFile(buffer), "text/csv")).toEqual(buffer);
    expect(originalFile("legacy csv", "text/csv").toString()).toBe("legacy csv");
    expect(originalFile(Buffer.from("pdf").toString("base64"), "application/pdf").toString()).toBe("pdf");
  });
  it("conserva las fechas independientemente del nombre/fecha de subida", async () => {
    const buffer = Buffer.from("Fecha;Concepto;Importe;Saldo\n01/06/2026;SALARY;1400,00;1400,00");
    const a = await analyzeImportFile({ buffer, fileName: "diciembre-2030.csv", mimeType: "text/csv", forcedFormat: "BBVA" });
    const b = await analyzeImportFile({ buffer, fileName: "otro.csv", mimeType: "text/csv", forcedFormat: "BBVA" });
    expect(a.startDate).toBe(b.startDate); expect(a.startDate).toContain("2026-06-01");
    expect(deserializePreviewMovement(a.movements[0]).cleanDescription).toBe("SALARY");
    expect(extractDeclaredBalances("Opening balance: 1,234.56 EUR\nClosing balance: 1,200.00 EUR")).toEqual({ opening: 1234.56, closing: 1200 });
  });
});

describe("notificaciones no son extractos", () => {
  const parse = (body: string, extra = {}) => interpretNotification({ eventId: "fixture", body, ...extra });
  it.each(["Has pagat 12,30 € a SUPERMERCAT", "Pago de 12,30 € en SUPERMERCADO", "Card payment 12.30 EUR at GROCERY", "Card payment €12.30 at GROCERY"])("interpreta %s como provisional", (text) => {
    const row = parse(text, { occurredAt: "2026-06-19" }); expect(row.amount).toBe(-12.3); expect(row.status).toBe("PENDING"); expect(row.confidence).toBe("media");
  });
  it("no inventa importe, fecha bancaria o cuenta a partir de recepción", () => {
    const row = parse("Pago en comercio. Consulta tu banco."); expect(row.amount).toBeNull(); expect(row.occurredAt).toBeNull(); expect(row.status).toBe("REVIEW");
    expect(parse("Pago 20,00 €; saldo 100,00 €").amount).toBeNull();
    expect(parse("Payment 1.234,567 €").amount).toBeNull();
    expect(parse("Pago 20 USD").amount).toBeNull();
  });
  it("distingue retenciones, liberaciones y posibles devoluciones", () => {
    expect(parse("Preautorización pago gasolina 100,00 €").status).toBe("AUTHORIZATION");
    expect(parse("Retenció pagament benzinera 100,00 €").status).toBe("AUTHORIZATION");
    expect(parse("Authorization reversed 100.00 EUR").status).toBe("REVERSED");
    const refund = parse("Refund 12.00 EUR", { occurredAt: "2026-06-20" }); expect(refund.amount).toBe(12); expect(refund.reason).toMatch(/Posible devolución/);
  });
});
