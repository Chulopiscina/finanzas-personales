import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createShortcutDevice, receiveNotification, reconcileNotifications, shortcutTokenHash } from "@/lib/shortcuts";
import { getDashboardData } from "@/lib/finance";
import { confirmStatement } from "@/lib/import-service";

const url = process.env.TEST_DATABASE_URL;
if (url && (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/finanzas_test")) throw new Error("Solo BD local desechable.");
describe.skipIf(!url)("bandeja de Atajos aislada del libro contable", () => {
  const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  let userId: string, accountId: string, otherAccount: string, foreign: string, token: string;
  beforeAll(async () => {
    userId = (await db.user.create({ data: { name: "Shortcuts", email: randomUUID() + "@example.test", passwordHash: "fixture" } })).id;
    accountId = (await db.account.create({ data: { userId, name: "Banco" } })).id;
    otherAccount = (await db.account.create({ data: { userId, name: "Otro" } })).id;
    const other = await db.user.create({ data: { name: "Other", email: randomUUID() + "@example.test", passwordHash: "fixture" } });
    foreign = (await db.account.create({ data: { userId: other.id, name: "Privada" } })).id;
    token = (await createShortcutDevice(userId, accountId, "iPhone ficticio")).token;
  });
  afterAll(async () => { await db.$disconnect(); const { prisma } = await import("@/lib/prisma"); await prisma.$disconnect(); });
  const payload = (body: string, extra = {}) => ({ eventId: randomUUID(), body, occurredAt: "2026-06-19", ...extra });
  const receive = (body: object) => receiveNotification("Bearer " + token, body);
  const movement = (concept: string, amount: number, account = accountId) => db.transaction.create({ data: { userId, accountId: account, concept, amount, date: new Date("2026-06-19"), type: amount < 0 ? "EXPENSE" : "INCOME", sourceHash: randomUUID() } });
  it("credencial aleatoria hasheada, limitada a cuenta propia, sin aceptar cuenta del payload", async () => {
    await expect(createShortcutDevice(userId, foreign, "No")).rejects.toThrow();
    await expect(receiveNotification("Bearer fp_" + "a".repeat(43), payload("Pago 10,00 €"))).rejects.toMatchObject({ status: 401 });
    const row = await receive(payload("Pago 10,00 €", { accountId: foreign, userId: "foreign" }));
    const event = await db.bankNotification.findUniqueOrThrow({ where: { id: row.id } });
    expect(event.accountId).toBe(accountId); expect(event.userId).toBe(userId);
    const device = await db.shortcutDevice.findUniqueOrThrow({ where: { tokenHash: shortcutTokenHash(token) } });
    expect(device.tokenHash).not.toBe(token); expect(device.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
  it("reintentos simultáneos idempotentes y conflicto si se reutiliza eventId con otro contenido", async () => {
    const body = payload("Pago 15,00 €");
    const results = await Promise.all([receive(body), receive(body)]);
    expect(new Set(results.map((row) => row.id)).size).toBe(1);
    expect(results.filter((row) => row.duplicate)).toHaveLength(1);
    await expect(receive({ ...body, body: "Pago 16,00 €" })).rejects.toMatchObject({ status: 409 });
  });
  it("retenciones, liberaciones e incompletos no alteran saldos/ciclos/gastos", async () => {
    await receive(payload("Preautorización gasolina 100,00 €", { merchant: "Gasolinera" }));
    await receive(payload("Retención liberada 100,00 €"));
    const missing = await receive({ eventId: randomUUID(), body: "Pago sin importe" });
    expect((await db.bankNotification.findUniqueOrThrow({ where: { id: missing.id } })).occurredAt).toBeNull();
    const data = await getDashboardData(userId, accountId, "all");
    expect(data.metrics.currentBalance).toBe(0); expect(data.metrics.totalExpenses).toBe(0); expect(data.metrics.totalIncome).toBe(0);
    expect(await db.transaction.count({ where: { userId } })).toBe(0);
  });
  it("concilia importe/fecha/comercio únicos con el extracto sin crear un segundo movimiento", async () => {
    const row = await receive(payload("Pagament 12,30 €", { merchant: "SUPERMERCAT" }));
    const data = { bankName: "BBVA", confidence: "media", validationStatus: "aviso", movements: [{ date: "2026-06-19T00:00:00.000Z", concept: "Pagament amb targeta SUPERMERCAT", cleanDescription: "SUPERMERCAT", amount: -12.3, balance: null, categoryName: "Supermercado", type: "EXPENSE", sourceHash: randomUUID(), raw: {} }] };
    const statement = await db.importHistory.create({ data: { userId, accountId, fileName: "future-name-2030.csv", fileHash: randomUUID(), status: "PENDING", rowCount: 1, insertedRows: 0, duplicateRows: 0, previewData: data } });
    await confirmStatement(statement.id, { id: userId, role: "USER" }, false);
    const event = await db.bankNotification.findUniqueOrThrow({ where: { id: row.id } });
    expect(event.status).toBe("RECONCILED"); expect(event.transactionId).toBeTruthy();
    await confirmStatement(statement.id, { id: userId, role: "USER" }, false);
    expect(await db.transaction.count({ where: { userId, amount: -12.3 } })).toBe(1);
    expect((await getDashboardData(userId, accountId, "all")).metrics.netExpenses).toBe(12.3);
    expect((event.rawPayload as { merchant: string }).merchant).toBe("SUPERMERCAT");
  });
  it("concilia notificación posterior al extracto y rechaza cuentas o coincidencias ambiguas", async () => {
    const tx = await movement("Comercio Unico", -22);
    const row = await receive(payload("Pago 22,00 €", { merchant: "Comercio Unico" }));
    expect((await db.bankNotification.findUniqueOrThrow({ where: { id: row.id } })).transactionId).toBe(tx.id);
    await movement("Otro Comercio", -23, otherAccount);
    const wrong = await receive(payload("Pago 23,00 €", { merchant: "Otro Comercio" }));
    expect(wrong.status).toBe("PENDING");
    await movement("Repetido", -24); await movement("Repetido", -24);
    const ambiguous = await receive(payload("Pago 24,00 €", { merchant: "Repetido" }));
    expect(ambiguous.status).toBe("PENDING");
  });
  it("no empareja automáticamente retenciones por importe ni devoluciones ambiguas", async () => {
    const hold = await receive(payload("Preautorización gasolina 100,00 €", { merchant: "Gasolinera" }));
    await movement("Gasolinera", -40);
    await db.$transaction((tx) => reconcileNotifications(tx, userId, accountId));
    expect((await db.bankNotification.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe("AUTHORIZATION");
    const refund = await receive(payload("Refund 5,00 €"));
    expect(refund.status).toBe("PENDING");
    expect(await db.transactionReimbursement.count({ where: { reimbursement: { userId } } })).toBe(0);
  });
  it("revocación, caducidad y límite persistente", async () => {
    const device = await createShortcutDevice(userId, accountId, "Revocado");
    await db.shortcutDevice.update({ where: { id: device.device.id }, data: { revokedAt: new Date() } });
    await expect(receiveNotification("Bearer " + device.token, payload("Pago 1,00 €"))).rejects.toMatchObject({ status: 401 });
    const expired = await createShortcutDevice(userId, accountId, "Caducado");
    await db.shortcutDevice.update({ where: { id: expired.device.id }, data: { expiresAt: new Date(0) } });
    await expect(receiveNotification("Bearer " + expired.token, payload("Pago 1,00 €"))).rejects.toMatchObject({ status: 401 });
    const limited = await createShortcutDevice(userId, accountId, "Limitado");
    await db.shortcutDevice.update({ where: { id: limited.device.id }, data: { windowCount: 120 } });
    await expect(receiveNotification("Bearer " + limited.token, payload("Pago 1,00 €"))).rejects.toMatchObject({ status: 429 });
  });
  it("desactivada no consulta tablas nuevas ni impide dashboard/importaciones antiguas", async () => {
    const { prisma } = await import("@/lib/prisma");
    let blocked = true;
    prisma.$use(async (params, next) => {
      if (blocked && ["ShortcutDevice", "BankNotification"].includes(params.model ?? "")) throw new Error("Tabla aún no migrada");
      return next(params);
    });
    const previous = process.env.SHORTCUTS_ENABLED;
    process.env.SHORTCUTS_ENABLED = "false";
    try {
      await expect(receive(payload("Pago 10,00 €"))).rejects.toMatchObject({ status: 503 });
      expect((await getDashboardData(userId, accountId, "all")).metrics.netExpenses).toBeGreaterThan(0);
      const statement = await db.importHistory.create({ data: { userId, accountId, fileName: "legacy.csv", fileHash: randomUUID(), status: "PENDING", rowCount: 1, insertedRows: 0, duplicateRows: 0, previewData: { confidence: "media", validationStatus: "aviso", movements: [{ date: "2026-06-20", concept: "Sin integración", amount: -2, balance: null, categoryName: "Otros", type: "EXPENSE", sourceHash: randomUUID(), raw: {} }] } } });
      expect((await confirmStatement(statement.id, { id: userId, role: "USER" }, false)).insertedRows).toBe(1);
    } finally { blocked = false; process.env.SHORTCUTS_ENABLED = previous; }
  });
  it("la bandeja no impide la eliminación explícita de un usuario de prueba", async () => {
    const owner = await db.user.create({ data: { name: "Disposable", email: randomUUID() + "@example.test", passwordHash: "fixture" } });
    const account = await db.account.create({ data: { userId: owner.id, name: "Ficticia" } });
    const device = await createShortcutDevice(owner.id, account.id, "Fixture");
    await receiveNotification("Bearer " + device.token, { eventId: randomUUID(), body: "Notificación de prueba" });
    await db.user.delete({ where: { id: owner.id } });
    expect(await db.bankNotification.count({ where: { userId: owner.id } })).toBe(0);
  });
});
