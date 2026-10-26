import { describe, expect, it } from "vitest";
import {
  calendarMonthLabel, compactMonthCalendarDays, madridToday, monthCalendarDays, occurrenceStatus,
  paymentsInMonth, shiftCalendarMonth, type CalendarPayment,
} from "@/lib/recurring-calendar";
import { nextRecurringPaymentDate } from "@/lib/recurring-payments";

const payment = (overrides: Partial<CalendarPayment> = {}): CalendarPayment => ({
  id: "payment", name: "Seguro", amount: 45, nextChargeDate: "2026-01-31T00:00:00.000Z",
  frequency: "MONTHLY", status: "ACTIVE", accountName: "BBVA", categoryName: null, ...overrides,
});

describe("calendario de pagos: proyecciones sin crear ni confirmar cobros", () => {
  it("usa lunes como primer día y seis semanas estables", () => {
    const days = monthCalendarDays("2026-02");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-01-26");
    expect(days.at(-1)).toBe("2026-03-08");
    expect(new Set(days).size).toBe(42);
  });
  it("navega entre años y muestra el mes en español", () => {
    expect(shiftCalendarMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftCalendarMonth("2026-01", -1)).toBe("2025-12");
    expect(calendarMonthLabel("2026-07")).toBe("julio de 2026");
  });
  it("el widget usa cinco semanas o seis solo si hace falta", () => {
    expect(compactMonthCalendarDays("2026-10")).toHaveLength(35);
    expect(compactMonthCalendarDays("2026-03")).toHaveLength(42);
    expect(compactMonthCalendarDays("2027-02")).toHaveLength(35);
    for (const month of ["2026-10", "2026-03", "2027-02"]) {
      const days = compactMonthCalendarDays(month);
      const expected = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
      expect(days.filter((day) => day.startsWith(month))).toHaveLength(expected);
      expect(new Date(days.at(-1)!).getUTCDay()).toBe(0);
    }
  });
  it("recupera el día original después de febrero, igual que la proyección existente", () => {
    const row = payment();
    for (const month of ["2026-02", "2026-03", "2026-04", "2027-01"]) {
      const expected = nextRecurringPaymentDate(new Date(row.nextChargeDate), row.frequency, new Date(`${month}-01`));
      expect(paymentsInMonth([row], month)[0].date).toBe(expected?.toISOString().slice(0, 10));
    }
    expect(paymentsInMonth([row], "2026-02")[0].date).toBe("2026-02-28");
    expect(paymentsInMonth([row], "2026-03")[0].date).toBe("2026-03-31");
  });
  it("respeta años bisiestos y frecuencias trimestrales/anuales", () => {
    const annual = payment({ frequency: "ANNUAL", nextChargeDate: "2024-02-29" });
    expect(paymentsInMonth([annual], "2025-02")[0].date).toBe("2025-02-28");
    expect(paymentsInMonth([annual], "2028-02")[0].date).toBe("2028-02-29");
    const quarterly = payment({ frequency: "QUARTERLY" });
    expect(paymentsInMonth([quarterly], "2026-02")).toEqual([]);
    expect(paymentsInMonth([quarterly], "2026-04")[0].date).toBe("2026-04-30");
  });
  it("no inventa ocurrencias anteriores a la fecha guardada", () => {
    expect(paymentsInMonth([payment()], "2025-12")).toEqual([]);
  });
  it.each(["ONCE", "OTHER"] as const)("no repite la frecuencia %s", (frequency) => {
    const row = payment({ frequency });
    expect(paymentsInMonth([row], "2026-01")).toHaveLength(1);
    expect(paymentsInMonth([row], "2027-01")).toEqual([]);
  });
  it("omite pausados, cancelados y fechas inválidas, sin mutar los originales", () => {
    const rows = [payment({ status: "PAUSED" }), payment({ status: "CANCELED" }), payment({ nextChargeDate: "invalid" })];
    const before = structuredClone(rows);
    expect(paymentsInMonth(rows, "2026-07")).toEqual([]);
    expect(rows).toEqual(before);
  });
  it("ordena cronológicamente sin duplicar pagos que coinciden el mismo día", () => {
    const rows = [payment({ id: "b" }), payment({ id: "a", nextChargeDate: "2026-01-02" }), payment({ id: "c" })];
    const result = paymentsInMonth(rows, "2026-07");
    expect(result.map((item) => item.payment.id)).toEqual(["a", "b", "c"]);
    expect(new Set(result.map((item) => item.id)).size).toBe(3);
  });
  it("nunca da por pagada una previsión pasada", () => {
    expect(occurrenceStatus("2026-06-01", "2026-07-01")).toEqual({ label: "Sin confirmar", tone: "past" });
    expect(occurrenceStatus("2026-07-01", "2026-07-01")).toEqual({ label: "Hoy", tone: "today" });
    expect(occurrenceStatus("2026-07-02", "2026-07-01").label).toBe("en 1 día");
    expect(occurrenceStatus("2026-07-04", "2026-07-01").label).toBe("en 3 días");
    expect(occurrenceStatus("2026-03-30", "2026-03-29").label).toBe("en 1 día");
  });
  it("resalta hoy según Madrid incluso al cruzar medianoche y cambios de hora", () => {
    expect(madridToday(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02");
    expect(madridToday(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });
});
