import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { startShortcutPairing, exchangeShortcutPairing, verifyShortcutConnection } from "@/lib/shortcut-pairing";
import { receiveNotification, revokeShortcutAuthorizations, reconcileNotifications } from "@/lib/shortcuts";
import { setShortcutBinding, assignNotificationAccount } from "@/lib/shortcut-bindings";

const url = process.env.TEST_DATABASE_URL;
if (url && (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/finanzas_test")) throw new Error("Solo base local aislada.");
describe.skipIf(!url)("iPhone universal: aislamiento, enrutado y contabilidad", () => {
  const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  let owner: string, first: string, second: string, otherUser: string, foreign: string, deviceId: string, token: string;
  beforeEach(async () => {
    vi.stubEnv("SHORTCUTS_ENABLED", "true");
    vi.stubEnv("SHORTCUTS_INSTALL_URL", "https://www.icloud.com/shortcuts/" + "0".repeat(32));
    owner = (await db.user.create({ data: { name: "Universal fixture", email: randomUUID() + "@example.test", passwordHash: "fixture" } })).id;
    otherUser = (await db.user.create({ data: { name: "Private fixture", email: randomUUID() + "@example.test", passwordHash: "fixture" } })).id;
    first = (await db.account.create({ data: { userId: owner, name: "BBVA fixture" } })).id;
    second = (await db.account.create({ data: { userId: owner, name: "ING fixture" } })).id;
    foreign = (await db.account.create({ data: { userId: otherUser, name: "Private" } })).id;
    const p = await startShortcutPairing(owner, first, "https://finance.example", undefined, "bbva");
    const setup = JSON.parse(new URL(p.setupUrl).searchParams.get("text")!);
    expect(setup.version).toBe(2);
    const d = await exchangeShortcutPairing(setup.code); deviceId = d.deviceId; token = d.token;
    expect(d).toMatchObject({ protocolVersion: 2, bankLabel: "BBVA", accountLabel: "BBVA fixture", profileLabel: expect.stringContaining("@example.test") });
  });
  afterAll(async () => { vi.unstubAllEnvs(); await db.$disconnect(); const { prisma } = await import("@/lib/prisma"); await prisma.$disconnect(); });
  const send = (body: string, eventId = randomUUID()) => receiveNotification("Bearer " + token, { eventId, body });
  it("crea una vinculación inicial y añade bancos sin emitir otra credencial", async () => {
    expect((await db.shortcutDevice.findUniqueOrThrow({ where: { id: deviceId } })).isUniversal).toBe(true);
    await setShortcutBinding(owner, deviceId, "ing", second);
    await setShortcutBinding(owner, deviceId, "trade-republic", second);
    expect(await db.shortcutDevice.count({ where: { userId: owner } })).toBe(1);
    expect(await db.shortcutBankBinding.count({ where: { deviceId } })).toBe(3);
    expect(await verifyShortcutConnection("Bearer " + token)).toMatchObject({ connection: "verified" });
    const bbva = await send("BBVA: Pago 10 EUR"), ing = await send("ING: We charged 10 EUR"), tr = await send("Trade Republic: Card transaction 10 EUR");
    expect((await db.bankNotification.findUniqueOrThrow({ where: { id: bbva.id } })).accountId).toBe(first);
    expect((await db.bankNotification.findUniqueOrThrow({ where: { id: ing.id } })).accountId).toBe(second);
    expect((await db.bankNotification.findUniqueOrThrow({ where: { id: tr.id } })).bankId).toBe("trade-republic");
    expect(await db.transaction.count({ where: { userId: owner } })).toBe(0);
  });
  it("jamás cae en la primera cuenta cuando falta banco, hay conflicto o no está vinculado", async () => {
    for (const body of ["Pago 10 EUR", "ING: Pago 10 EUR", "Unknown: Pago 10 EUR", "Transferencia BBVA a Trade Republic 10 EUR"]) {
      const e = await send(body);
      expect(await db.bankNotification.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ accountId: null, status: "REVIEW", body });
    }
  });
  it("rechaza recursos ajenos, bancos desconocidos, divisas y credenciales revocadas", async () => {
    await expect(setShortcutBinding(otherUser, deviceId, "ing", foreign)).rejects.toMatchObject({ status: 404 });
    await expect(setShortcutBinding(owner, deviceId, "ing", foreign)).rejects.toThrow();
    await expect(setShortcutBinding(owner, deviceId, "not-supported", second)).rejects.toThrow();
    await db.account.update({ where: { id: second }, data: { currency: "USD" } });
    await expect(setShortcutBinding(owner, deviceId, "ing", second)).rejects.toThrow();
    await db.$transaction(tx => revokeShortcutAuthorizations(tx, owner));
    await expect(setShortcutBinding(owner, deviceId, "ing", first)).rejects.toMatchObject({ status: 404 });
    await expect(send("BBVA: Pago 10 EUR")).rejects.toMatchObject({ status: 401 });
  });
  it("los reintentos no reasignan avisos antiguos después de cambiar una vinculación", async () => {
    const id = randomUUID(), body = "BBVA: Pago 10 EUR";
    const original = await send(body, id);
    await setShortcutBinding(owner, deviceId, "bbva", second);
    expect(await send(body, id)).toMatchObject({ id: original.id, duplicate: true });
    expect((await db.bankNotification.findUniqueOrThrow({ where: { id: original.id } })).accountId).toBe(first);
    await expect(send("BBVA: Pago 11 EUR", id)).rejects.toMatchObject({ status: 409 });
    expect((await db.bankNotification.findUniqueOrThrow({ where: { id: (await send(body)).id } })).accountId).toBe(second);
  });
  it("la asignación manual conserva el original y exige propiedad de cuenta y aviso", async () => {
    const body = "Pago 10 EUR sin banco";
    const e = await send(body);
    await expect(assignNotificationAccount(otherUser, e.id, foreign)).rejects.toMatchObject({ status: 404 });
    await expect(assignNotificationAccount(owner, e.id, foreign)).rejects.toThrow();
    await assignNotificationAccount(owner, e.id, second);
    expect(await db.bankNotification.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ accountId: second, body, rawPayload: { eventId: expect.any(String), body }, status: "REVIEW" });
    expect(await db.transaction.count({ where: { userId: owner } })).toBe(0);
  });
  it("archivar la cuenta inicial no desconecta los otros bancos; desvincular no borra avisos", async () => {
    await setShortcutBinding(owner, deviceId, "ing", second);
    const e = await send("ING: Pago 10 EUR");
    await db.account.update({ where: { id: first }, data: { isArchived: true } });
    expect(await verifyShortcutConnection("Bearer " + token)).toMatchObject({ ok: true });
    await setShortcutBinding(owner, deviceId, "ing", null);
    expect(await db.bankNotification.count({ where: { id: e.id } })).toBe(1);
    await expect(send("ING: Pago 10 EUR")).rejects.toMatchObject({ status: 401 });
  });
  it("concilia con una operación única existente, sin crear movimientos ni convertir retenciones", async () => {
    const movement = await db.transaction.create({ data: { userId: owner, accountId: first, date: new Date("2026-10-19"), concept: "MERCADONA", amount: -12.3, type: "EXPENSE", sourceHash: randomUUID() } });
    const e = await send("BBVA: Has pagado 12,30 EUR\nComercio: MERCADONA\nFecha: 2026-10-19");
    expect(await db.bankNotification.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ status: "RECONCILED", transactionId: movement.id });
    const hold = await send("BBVA: Retención 12,30 EUR\nComercio: MERCADONA\nFecha: 2026-10-19");
    await db.$transaction(tx => reconcileNotifications(tx, owner, first));
    expect((await db.bankNotification.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe("AUTHORIZATION");
    expect(await db.transaction.count({ where: { userId: owner } })).toBe(1);
  });
  it("conserva el contrato BBVA v1 y los dispositivos anteriores", async () => {
    vi.stubEnv("SHORTCUTS_BBVA_INSTALL_URL", "https://www.icloud.com/shortcuts/" + "0".repeat(32));
    const p = await startShortcutPairing(owner, first, "https://finance.example");
    const setup = JSON.parse(new URL(p.setupUrl).searchParams.get("text")!);
    expect(setup.version).toBe(1);
    const legacy = await exchangeShortcutPairing(setup.code);
    const e = await receiveNotification("Bearer " + legacy.token, { eventId: randomUUID(), body: "Pago 10 EUR" });
    expect(await db.bankNotification.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({ accountId: first });
    expect((await db.shortcutDevice.findUniqueOrThrow({ where: { id: legacy.deviceId } })).isUniversal).toBe(false);
  });
  it("la baja explícita de un usuario desechable conserva el comportamiento de cascada", async () => {
    await setShortcutBinding(owner, deviceId, "ing", second);
    await send("ING: Pago 10 EUR");
    await db.user.delete({ where: { id: owner } });
    expect(await db.shortcutBankBinding.count({ where: { userId: owner } })).toBe(0);
    expect(await db.bankNotification.count({ where: { userId: owner } })).toBe(0);
  });
});
