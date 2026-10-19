import { describe, expect, it } from "vitest";
import { identifyNotificationBank, notificationBanks } from "@/lib/notification-banks";
import { interpretNotification, notificationInput } from "@/lib/bank-notification";
import { shortcutInstallConfig, shortcutSetupLink } from "@/lib/shortcut-install";

describe("notificaciones universales: fixtures sintéticos, no certificación de apps", () => {
  it.each([
    ["bbva", "BBVA: Has pagado 12,30 EUR\nComercio: MERCADONA\nFecha: 2026-10-19", -12.3, "Supermercado"],
    ["ing", "ING: Hem carregat 23,40 EUR\nComerç: SUPERMERCAT\nData: 2026-10-19", -23.4, "Supermercado"],
    ["trade-republic", "Trade Republic: Card transaction 8.25 EUR\nMerchant: NETFLIX\nDate: 2026-10-19", -8.25, "Suscripciones"],
    ["bbva", "BBVA: Bizum rebut 10,00 EUR\nData: 2026-10-19", 10, "Otros"],
    ["ing", "ING: We credited 1400.00 EUR\nDate: 2026-10-19", 1400, "Otros"],
    ["trade-republic", "Trade Republic: Intereses abonados 12,30 EUR\nFecha: 2026-10-19", 12.3, "Otros"],
  ])("interpreta %s sin alterar el original", (bank, body, amount, categoryName) => {
    const input = notificationInput({ eventId: "synthetic", body });
    expect(identifyNotificationBank(input)).toBe(bank);
    expect(interpretNotification(input, bank)).toMatchObject({ amount, categoryName, status: "PENDING", occurredAt: new Date("2026-10-19T00:00:00Z") });
    expect(input.body).toBe(body);
  });
  it("no usa bancos mencionados en transferencias o comercios como identidad", () => {
    for (const body of ["Transferencia a BBVA desde ING 100 EUR", "Pago en Trade Republic 10 EUR", "Has pagado 4 EUR"]) expect(identifyNotificationBank({ body })).toBeNull();
    expect(identifyNotificationBank({ sourceApp: "ING España", body: "Transferencia a Trade Republic" })).toBe("ing");
    expect(identifyNotificationBank({ sourceApp: "BBVA", title: "ING", body: "Pago 10 EUR" })).toBeNull();
    expect(identifyNotificationBank({ bankId: "unknown-future-bank", body: "BBVA: Pago 10 EUR" })).toBeNull();
  });
  it.each(["BBVA: Retención gasolina 100,00 EUR", "ING: Preautorització 100,00 EUR", "Trade Republic: Pending card transaction 100.00 EUR"])("mantiene retenciones: %s", body => {
    expect(interpretNotification({ eventId: "hold", body }, identifyNotificationBank({ body }))).toMatchObject({ status: "AUTHORIZATION" });
  });
  it.each(["ING: Anul·lat 10 EUR", "BBVA: Liberada retención 100 EUR", "Trade Republic: Card transaction reversed 10 EUR"])("mantiene anulaciones: %s", body => {
    expect(interpretNotification({ eventId: "cancel", body }, identifyNotificationBank({ body }))).toMatchObject({ status: "REVERSED" });
  });
  it("revisa saldos, direcciones contradictorias, fechas incompletas y devoluciones", () => {
    const analyze = (body: string) => interpretNotification({ eventId: "review", body }, "ing");
    expect(analyze("ING: Pago 12 EUR. Saldo 500 EUR")).toMatchObject({ amount: null, status: "REVIEW" });
    expect(analyze("ING: Ingreso -12 EUR 2026-10-19")).toMatchObject({ amount: null, status: "REVIEW" });
    expect(analyze("ING: Pago 12 EUR el 01/02/2026")).toMatchObject({ occurredAt: null, status: "REVIEW" });
    expect(analyze("ING: Pago 12 EUR 2026-10-19 y 2026-10-20")).toMatchObject({ occurredAt: null, status: "REVIEW" });
    expect(analyze("ING: Pago 12 EUR\nCaduca: 2026-10-19")).toMatchObject({ occurredAt: null, status: "REVIEW" });
    expect(analyze("ING: Refund 12 EUR")).toMatchObject({ amount: 12, status: "REVIEW" });
    expect(analyze("ING: Refund 12 EUR\nDate: 2026-10-19").reason).toContain("confirmar con extracto");
  });
  it("separa el instalador universal del BBVA antiguo", () => {
    expect(shortcutInstallConfig("universal").name).toBe("Finanzas Bancarias");
    const url = new URL(shortcutSetupLink("https://finance.example", "pair_fixture", "universal"));
    expect(url.searchParams.get("name")).toBe("Finanzas Bancarias");
    expect(url.href).toContain("name=Finanzas%20Bancarias");
    expect(url.href).not.toContain("+");
    expect(JSON.parse(url.searchParams.get("text")!)).toMatchObject({ version: 2 });
    expect(JSON.parse(new URL(shortcutSetupLink("https://finance.example", "pair_fixture")).searchParams.get("text")!)).toMatchObject({ version: 1 });
    expect(notificationBanks.every(b => b.status.includes("sin validación en iPhone"))).toBe(true);
  });
});
