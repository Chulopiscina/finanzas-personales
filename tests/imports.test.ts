import { describe, expect, it } from "vitest";
import { classify, parseBBVACsv, parseSpanishDate, parseTradeRepublicCsv } from "@/lib/csv";
import { parseBBVAPdfText, parseCaixaBankPdfText, parseINGPdfText } from "@/lib/pdf";
import { planImport } from "@/lib/import-identity";
import { validateBalances } from "@/lib/import-preview";
const csv = "Fecha;Concepto;Importe;Saldo\n19/06/2026;BIZUM ENVIADO Test;-290,00;12.848,43";
describe("importación segura", () => {
  it.each(["31/02/2026", "29/02/2025", "2026-02-31", "99/01/2026", "invalid"])("rechaza fecha imposible %s", (date) => expect(() => parseSpanishDate(date)).toThrow());
  it("admite años bisiestos", () => expect(parseSpanishDate("29/02/2024").getUTCDate()).toBe(29));
  it("conserva el día contable ISO y prioriza Date sobre DateTime", () => {
    expect(parseSpanishDate("2026-06-19T23:00:00-02:00").toISOString()).toBe("2026-06-19T00:00:00.000Z");
    const rows = parseTradeRepublicCsv("DateTime,Date,Description,Amount,Currency,Transaction ID\n2026-06-20T00:00:00Z,2026-06-19,Trade Republic test,10.00,EUR,fixture-id");
    expect(rows[0].date.toISOString()).toBe("2026-06-19T00:00:00.000Z");
  });
  it.each(["NOMINA", "NÓMINA", "ABONO DE NÓMINA", "NOMINES", "NÓMINES", "TRANSFERENCIA NOMINA"])("detecta %s positiva", (text) => expect(classify(text, 1400).type).toBe("INCOME"));
  it("no convierte nóminas negativas ni alquileres en ingreso/traspaso", () => {
    expect(classify("DEVOLUCION NOMINA", -1400).type).toBe("EXPENSE");
    expect(classify("TRANSFERENCIA ALQUILER", -600).type).toBe("EXPENSE");
  });
  it("ignora pies de página y códigos BBVA", () => {
    const rows = parseBBVAPdfText("BBVA 01/06/2026\n19/06 19/06 BIZUM ENVIADO Test -290,00 12.848,43\nSaldo final 1.661,54\nS30000012345\n25/06 25/06 SUPERMERCADO -20,00 12.828,43");
    expect(rows.map((row) => row.amount)).toEqual([-290, -20]);
    expect(planImport(rows.slice(0, 1), parseBBVACsv(csv)).duplicates).toBe(1);
  });
  it("preserva dos operaciones legítimas idénticas sin saldo", () => {
    const rows = parseBBVACsv("Fecha;Concepto;Importe\n19/06/2026;Cafe;-2,00\n19/06/2026;Cafe;-2,00");
    const plan = planImport(rows, []);
    expect(plan.inserts).toHaveLength(2);
    expect(new Set(plan.inserts.map((row) => row.sourceHash)).size).toBe(2);
    expect(planImport(rows, plan.inserts).duplicates).toBe(2);
  });
  it("no confunde operaciones con saldos diferentes", () => {
    const row = parseBBVACsv(csv)[0];
    expect(planImport([row], [{ ...row, balance: 10 }]).inserts).toHaveLength(1);
  });
  it("detecta inconsistencias de fila aunque el total coincida", () => {
    const rows = parseBBVACsv("Fecha;Concepto;Importe;Saldo\n01/06/2026;COMPRA;-10,00;85,00\n02/06/2026;COMPRA;-20,00;70,00");
    expect(validateBalances(rows, { opening: 100, closing: 70 }).message).toMatch(/no cuadran/);
  });
  it("no declara alta confianza a saldos inferidos", () => expect(validateBalances(parseBBVACsv(csv)).message).toMatch(/inferidos/));
  it("lee ING y CaixaBank y rechaza filas incompletas", () => {
    expect(parseINGPdfText("19/06/2026 BIZUM 19/06/2026 12.848,43 € -290,00 €")[0].amount).toBe(-290);
    expect(parseCaixaBankPdfText("COMPRA 19/06/2026 -290,00 € 12.848,43 €")[0].balance).toBe(12848.43);
    expect(() => parseINGPdfText("19/06/2026 INVALIDO\n20/06/2026 BIZUM 20/06/2026 100,00 € 10,00 €")).toThrow();
  });
});
