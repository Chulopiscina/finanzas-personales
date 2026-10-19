import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { startShortcutPairing, exchangeShortcutPairing, shortcutPairingStatus, verifyShortcutConnection } from "@/lib/shortcut-pairing";
import { receiveNotification, revokeShortcutAuthorizations, shortcutTokenHash, requireShortcutSetup, shortcutsEnabled } from "@/lib/shortcuts";
import { setShortcutBinding } from "@/lib/shortcut-bindings";

const url = process.env.TEST_DATABASE_URL;
if (url && (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/finanzas_test")) throw new Error("Solo base local aislada.");
describe.skipIf(!url)("instalación y vinculación sin recepción de notificaciones", () => {
  const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  let owner: string, account: string, other: string, foreign: string;
  beforeEach(async () => {
    vi.stubEnv("SHORTCUTS_ENABLED", "false");
    vi.stubEnv("SHORTCUTS_SETUP_ENABLED", "true");
    vi.stubEnv("SHORTCUTS_INSTALL_URL", "");
    owner = (await db.user.create({ data: { name: "Setup owner", email: randomUUID() + "@example.test", passwordHash: "fixture" } })).id;
    other = (await db.user.create({ data: { name: "Setup other", email: randomUUID() + "@example.test", passwordHash: "fixture" } })).id;
    account = (await db.account.create({ data: { userId: owner, name: "Cuenta propia" } })).id;
    foreign = (await db.account.create({ data: { userId: other, name: "Cuenta ajena" } })).id;
  });
  afterAll(async () => { vi.unstubAllEnvs(); await db.$disconnect(); const { prisma } = await import("@/lib/prisma"); await prisma.$disconnect(); });
  const pair = async (bank: string, userId = owner, accountId = account) => {
    const pairing = await startShortcutPairing(userId, accountId, "https://finance.example", undefined, bank);
    const setup = JSON.parse(new URL(pairing.setupUrl).searchParams.get("text")!);
    const device = await exchangeShortcutPairing(setup.code);
    return { pairing, setup, device };
  };
  it.each(["bbva", "ing", "trade-republic"])("vincula %s sin aceptar eventos ni crear movimientos", async bank => {
    const { pairing, device, setup } = await pair(bank);
    expect(setup.version).toBe(2);
    expect(device.token).toMatch(/^fp_[A-Za-z0-9_-]{43}$/);
    const stored = await db.shortcutDevice.findUniqueOrThrow({ where: { id: device.deviceId }, include: { bankBindings: true } });
    expect(stored.tokenHash).toBe(shortcutTokenHash(device.token));
    expect(stored.bankBindings).toEqual([expect.objectContaining({ userId: owner, accountId: account, bankId: bank })]);
    expect(await verifyShortcutConnection("Bearer " + device.token)).toMatchObject({ connection: "verified", receiptEnabled: false });
    expect(await shortcutPairingStatus(owner, pairing.id)).toMatchObject({ status: "verified", receiptEnabled: false, lastNotificationAt: null });
    await expect(receiveNotification("Bearer " + device.token, { eventId: randomUUID(), body: "BBVA: Pago 10 EUR" })).rejects.toMatchObject({ status: 503 });
    expect(await db.bankNotification.count({ where: { userId: owner } })).toBe(0);
    expect(await db.transaction.count({ where: { userId: owner } })).toBe(0);
    await expect(exchangeShortcutPairing(setup.code)).rejects.toMatchObject({ status: 410 });
    expect(shortcutsEnabled()).toBe(false);
  });
  it("mantiene credenciales y gestión aisladas entre usuarios del mismo instalador", async () => {
    const a = await pair("bbva");
    const b = await pair("ing", other, foreign);
    expect(a.device.token).not.toBe(b.device.token);
    expect(a.setup.code).not.toBe(b.setup.code);
    await expect(shortcutPairingStatus(other, a.pairing.id)).rejects.toMatchObject({ status: 404 });
    await expect(setShortcutBinding(other, a.device.deviceId, "ing", foreign)).rejects.toMatchObject({ status: 404 });
    await expect(setShortcutBinding(owner, a.device.deviceId, "ing", foreign)).rejects.toThrow();
    await expect(startShortcutPairing(owner, foreign, "https://finance.example", undefined, "bbva")).rejects.toThrow();
    expect(JSON.stringify(await shortcutPairingStatus(owner, a.pairing.id))).not.toContain(a.device.token);
  });
  it("añade bancos y permite desconectar con recepción desactivada", async () => {
    const { device } = await pair("bbva");
    await setShortcutBinding(owner, device.deviceId, "ing", account);
    await setShortcutBinding(owner, device.deviceId, "trade-republic", account);
    expect(await db.shortcutBankBinding.count({ where: { deviceId: device.deviceId } })).toBe(3);
    expect(await db.shortcutDevice.count({ where: { userId: owner } })).toBe(1);
    await db.$transaction(tx => revokeShortcutAuthorizations(tx, owner));
    await expect(verifyShortcutConnection("Bearer " + device.token)).rejects.toMatchObject({ status: 401 });
    expect(await db.transaction.count({ where: { userId: owner } })).toBe(0);
  });
  it("el interruptor de instalación sigue bloqueando códigos nuevos y canjes", async () => {
    const p = await startShortcutPairing(owner, account, "https://finance.example", undefined, "bbva");
    const setup = JSON.parse(new URL(p.setupUrl).searchParams.get("text")!);
    vi.stubEnv("SHORTCUTS_SETUP_ENABLED", "false");
    expect(() => requireShortcutSetup()).toThrow();
    await expect(exchangeShortcutPairing(setup.code)).rejects.toMatchObject({ status: 503 });
    expect(await db.shortcutDevice.count({ where: { userId: owner } })).toBe(0);
  });
});
