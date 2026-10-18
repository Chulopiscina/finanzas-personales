import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { startShortcutPairing, exchangeShortcutPairing, shortcutPairingStatus, verifyShortcutConnection } from "@/lib/shortcut-pairing";
import { receiveNotification, revokeShortcutAuthorizations, shortcutTokenHash } from "@/lib/shortcuts";
const url = process.env.TEST_DATABASE_URL;
if (url && (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/finanzas_test")) throw new Error("Solo base local aislada.");
describe.skipIf(!url)("vinculación guiada de un solo uso", () => {
  const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  let owner: string, account: string;
  const origin = "https://finance.example";
  const codeFrom = (setupUrl: string) => JSON.parse(new URL(setupUrl).searchParams.get("text")!).code as string;
  beforeEach(async () => {
    vi.stubEnv("SHORTCUTS_ENABLED", "true");
    vi.stubEnv("SHORTCUTS_BBVA_INSTALL_URL", "https://www.icloud.com/shortcuts/" + "0".repeat(32));
    owner = (await db.user.create({ data: { name: "Pairing fixture", email: randomUUID() + "@example.test", passwordHash: "fixture" } })).id;
    account = (await db.account.create({ data: { userId: owner, name: "BBVA fixture" } })).id;
  });
  afterAll(async () => { vi.unstubAllEnvs(); await db.$disconnect(); const { prisma } = await import("@/lib/prisma"); await prisma.$disconnect(); });
  it("liga usuario/cuenta en servidor; ni código en claro en BD ni token en estado", async () => {
    const pairing = await startShortcutPairing(owner, account, origin), code = codeFrom(pairing.setupUrl);
    const stored = await db.shortcutPairing.findUniqueOrThrow({ where: { id: pairing.id } });
    expect(stored.codeHash).toBe(shortcutTokenHash(code)); expect(stored.codeHash).not.toBe(code);
    const device = await exchangeShortcutPairing(code);
    expect(device.token).toMatch(/^fp_[A-Za-z0-9_-]{43}$/);
    expect((await db.shortcutDevice.findUniqueOrThrow({ where: { id: device.deviceId } })).accountId).toBe(account);
    const status = await shortcutPairingStatus(owner, pairing.id);
    expect(status.status).toBe("paired"); expect(JSON.stringify(status)).not.toContain(device.token);
    await expect(shortcutPairingStatus("another-user", pairing.id)).rejects.toMatchObject({ status: 404 });
    await expect(startShortcutPairing("another-user", account, origin)).rejects.toThrow();
  });
  it("solo un canje concurrente crea dispositivo, sin duplicar credenciales", async () => {
    const pair = await startShortcutPairing(owner, account, origin), code = codeFrom(pair.setupUrl);
    const results = await Promise.allSettled([exchangeShortcutPairing(code), exchangeShortcutPairing(code)]);
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(x => x.status === "rejected")).toHaveLength(1);
    expect(await db.shortcutDevice.count({ where: { userId: owner } })).toBe(1);
    await expect(exchangeShortcutPairing(code)).rejects.toMatchObject({ status: 410 });
  });
  it("caducidad, sustitución, cuenta archivada y cambios de contraseña invalidan códigos", async () => {
    await expect(startShortcutPairing(owner, account, origin, "revoked-session")).rejects.toMatchObject({ status: 401 });
    const expired = await startShortcutPairing(owner, account, origin);
    await db.shortcutPairing.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } });
    await expect(exchangeShortcutPairing(codeFrom(expired.setupUrl))).rejects.toMatchObject({ status: 410 });
    const old = await startShortcutPairing(owner, account, origin);
    const current = await startShortcutPairing(owner, account, origin);
    await expect(exchangeShortcutPairing(codeFrom(old.setupUrl))).rejects.toMatchObject({ status: 410 });
    await db.account.update({ where: { id: account }, data: { isArchived: true } });
    await expect(exchangeShortcutPairing(codeFrom(current.setupUrl))).rejects.toMatchObject({ status: 410 });
    await db.account.update({ where: { id: account }, data: { isArchived: false } });
    const pending = await startShortcutPairing(owner, account, origin);
    await db.$transaction(tx => revokeShortcutAuthorizations(tx, owner));
    await expect(exchangeShortcutPairing(codeFrom(pending.setupUrl))).rejects.toMatchObject({ status: 410 });
  });
  it("prueba de conexión no crea eventos ni gastos; desconectar revoca envío y prueba", async () => {
    const p = await startShortcutPairing(owner, account, origin), d = await exchangeShortcutPairing(codeFrom(p.setupUrl));
    expect(await verifyShortcutConnection("Bearer " + d.token)).toMatchObject({ ok: true });
    expect(await shortcutPairingStatus(owner, p.id)).toMatchObject({ status: "verified", lastNotificationAt: null });
    expect(await db.bankNotification.count({ where: { userId: owner } })).toBe(0);
    expect(await db.transaction.count({ where: { userId: owner } })).toBe(0);
    await receiveNotification("Bearer " + d.token, { eventId: randomUUID(), body: "Pago 10,00 EUR" });
    expect((await shortcutPairingStatus(owner, p.id)).lastNotificationAt).not.toBeNull();
    await db.$transaction(tx => revokeShortcutAuthorizations(tx, owner));
    await expect(verifyShortcutConnection("Bearer " + d.token)).rejects.toMatchObject({ status: 401 });
    await expect(receiveNotification("Bearer " + d.token, { eventId: randomUUID(), body: "Pago 10,00 EUR" })).rejects.toMatchObject({ status: 401 });
    expect((await shortcutPairingStatus(owner, p.id)).status).toBe("disconnected");
    expect(await db.bankNotification.count({ where: { userId: owner } })).toBe(1);
  });
  it("un cambio de credenciales concurrente cancela el canje o revoca el dispositivo creado", async () => {
    const p = await startShortcutPairing(owner, account, origin);
    const [exchange, revoke] = await Promise.allSettled([
      exchangeShortcutPairing(codeFrom(p.setupUrl)),
      db.$transaction(async tx => {
        await revokeShortcutAuthorizations(tx, owner);
        await tx.user.update({ where: { id: owner }, data: { email: randomUUID() + "@example.test", passwordHash: "changed-fixture" } });
      })
    ]);
    expect(revoke.status).toBe("fulfilled");
    if (exchange.status === "fulfilled") await expect(verifyShortcutConnection("Bearer " + exchange.value.token)).rejects.toMatchObject({ status: 401 });
    else expect(exchange.reason).toMatchObject({ status: 410 });
    expect(await db.shortcutDevice.count({ where: { userId: owner, revokedAt: null } })).toBe(0);
  });
  it("no crea códigos sin atajo publicado, integración activa o divisa compatible", async () => {
    vi.stubEnv("SHORTCUTS_BBVA_INSTALL_URL", "");
    await expect(startShortcutPairing(owner, account, origin)).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("SHORTCUTS_BBVA_INSTALL_URL", "https://www.icloud.com/shortcuts/" + "0".repeat(32));
    await db.account.update({ where: { id: account }, data: { currency: "USD" } });
    await expect(startShortcutPairing(owner, account, origin)).rejects.toThrow();
    vi.stubEnv("SHORTCUTS_ENABLED", "false");
    await expect(exchangeShortcutPairing("pair_" + "a".repeat(43))).rejects.toMatchObject({ status: 503 });
    await expect(verifyShortcutConnection(null)).rejects.toMatchObject({ status: 503 });
    expect(await db.shortcutPairing.count({ where: { userId: owner } })).toBe(0);
  });
  it("limita altas por usuario y comprobaciones por credencial", async () => {
    let latest = "";
    for (let n = 0; n < 10; n++) latest = (await startShortcutPairing(owner, account, origin)).setupUrl;
    await expect(startShortcutPairing(owner, account, origin)).rejects.toMatchObject({ status: 429 });
    const active = await db.shortcutPairing.findFirstOrThrow({ where: { userId: owner, canceledAt: null } });
    expect(active.expiresAt.getTime() - active.createdAt.getTime()).toBeLessThanOrEqual(5 * 60_000);
    const device = await exchangeShortcutPairing(codeFrom(latest));
    await db.shortcutDevice.update({ where: { id: device.deviceId }, data: { windowCount: 120 } });
    await expect(verifyShortcutConnection("Bearer " + device.token)).rejects.toMatchObject({ status: 429 });
  });
  it("no resucita credenciales tras cambiar contraseña con Atajos desactivado", async () => {
    const first = await startShortcutPairing(owner, account, origin);
    const device = await exchangeShortcutPairing(codeFrom(first.setupUrl));
    const pending = await startShortcutPairing(owner, account, origin);
    vi.stubEnv("SHORTCUTS_ENABLED", "false");
    await db.$transaction(tx => revokeShortcutAuthorizations(tx, owner));
    vi.stubEnv("SHORTCUTS_ENABLED", "true");
    await expect(verifyShortcutConnection("Bearer " + device.token)).rejects.toMatchObject({ status: 401 });
    await expect(exchangeShortcutPairing(codeFrom(pending.setupUrl))).rejects.toMatchObject({ status: 410 });
  });
});
