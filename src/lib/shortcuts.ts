import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InputError } from "@/lib/input-error";
import { interpretNotification, matchesNotification, notificationInput } from "@/lib/bank-notification";
import { cents } from "@/lib/money";
import { identifyNotificationBank } from "@/lib/notification-banks";
import { activeShortcutBindings, shortcutAccountAvailable, shortcutAuthorizationInclude } from "@/lib/shortcut-accounts";

export function shortcutsEnabled() { return process.env.SHORTCUTS_ENABLED === "true"; }
export function requireShortcuts() {
  if (!shortcutsEnabled()) throw new InputError("La integración de Atajos no está habilitada. Requiere la migración autorizada y su activación posterior.", 503);
}
export const shortcutTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function revokeShortcutAuthorizations(tx: Prisma.TransactionClient, userId: string) {
  // Revocation must survive the emergency switch; otherwise old tokens revive
  // when notifications are enabled again after a password/role change.
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${"pairing:" + userId}))`;
  const now = new Date();
  await tx.shortcutDevice.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  await tx.shortcutPairing.updateMany({ where: { userId, consumedAt: null, canceledAt: null }, data: { canceledAt: now } });
}

export async function createShortcutDevice(userId: string, accountId: string, name: string) {
  requireShortcuts();
  if (!name.trim() || name.length > 100) throw new InputError("Nombre obligatorio (máximo 100 caracteres).");
  const account = await prisma.account.findFirst({ where: { id: accountId, userId, isArchived: false, currency: "EUR" } });
  if (!account) throw new InputError("Selecciona una cuenta propia activa en EUR.");
  const token = "fp_" + randomBytes(32).toString("base64url");
  const device = await prisma.shortcutDevice.create({ data: { userId, accountId, name: name.trim(), tokenHash: shortcutTokenHash(token), expiresAt: new Date(Date.now() + 90 * 86_400_000) }, select: { id: true, name: true, expiresAt: true } });
  return { device: { ...device, account: account.name, revoked: false }, token };
}

export async function receiveNotification(authorization: string | null, payload: unknown) {
  requireShortcuts();
  const token = authorization?.match(/^Bearer (fp_[A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) throw new InputError("Token de Atajos inválido.", 401);
  const input = notificationInput(payload);
  const tokenHash = shortcutTokenHash(token);
  const result = await prisma.$transaction(async (tx) => {
    // Lock per credential: rate limits and retries remain atomic across serverless instances.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${tokenHash}))`;
    const device = await tx.shortcutDevice.findUnique({ where: { tokenHash }, include: shortcutAuthorizationInclude });
    if (!device || device.revokedAt || device.expiresAt <= new Date() || !shortcutAccountAvailable(device)) throw new InputError("Token caducado, revocado o cuenta no disponible.", 401);
    const now = new Date(), reset = now.getTime() - device.windowStart.getTime() >= 3_600_000;
    if (!reset && device.windowCount >= 120) throw new InputError("Demasiadas notificaciones. Reintenta más tarde.", 429);
    await tx.shortcutDevice.update({ where: { id: device.id }, data: { lastUsedAt: now, windowStart: reset ? now : device.windowStart, windowCount: reset ? 1 : { increment: 1 } } });
    const existing = await tx.bankNotification.findUnique({ where: { deviceId_eventId: { deviceId: device.id, eventId: input.eventId } } });
    if (existing) {
      // PostgreSQL JSONB may reorder keys; compare their values, not serialization order.
      const raw = existing.rawPayload as Record<string, unknown>;
      if (Object.keys(raw).length !== Object.keys(input).length || Object.entries(input).some(([key, value]) => raw[key] !== value)) throw new InputError("eventId ya utilizado con contenido diferente.", 409);
      return { id: existing.id, status: existing.status, duplicate: true };
    }
    const bankId = device.isUniversal ? identifyNotificationBank(input) : null;
    const binding = device.isUniversal ? activeShortcutBindings(device).find(b => b.bankId === bankId) : null;
    const accountId = device.isUniversal ? binding?.accountId ?? null : device.accountId;
    const analysis = interpretNotification(input, device.isUniversal ? bankId : undefined);
    if (device.isUniversal && !accountId) {
      // Unknown/ambiguous app identity must never silently fall back to the first bank.
      if (!["AUTHORIZATION", "REVERSED"].includes(analysis.status)) analysis.status = "REVIEW";
      analysis.reason = "Banco o cuenta sin identificar/vincular. Asigna la cuenta manualmente; no se ha creado ningún movimiento. " + analysis.reason;
    }
    const event = await tx.bankNotification.create({ data: { ...analysis, bankId, userId: device.userId, deviceId: device.id, accountId, eventId: input.eventId, body: input.body, title: input.title, subtitle: input.subtitle, sourceApp: input.sourceApp, rawPayload: input as unknown as Prisma.InputJsonValue } });
    if (accountId) await reconcileNotifications(tx, device.userId, accountId, event.id);
    const updated = await tx.bankNotification.findUniqueOrThrow({ where: { id: event.id }, select: { id: true, status: true } });
    return { ...updated, duplicate: false };
  });
  return result;
}

export async function reconcileNotifications(tx: Prisma.TransactionClient, userId: string, accountId: string, eventId?: string) {
  if (!shortcutsEnabled()) return 0;
  // Same lock is used by statement imports. No parallel importer can create a second reconciliation.
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${userId}), hashtext(${accountId}))`;
  const events = await tx.bankNotification.findMany({ where: { userId, accountId, status: "PENDING", transactionId: null, occurredAt: { not: null }, amount: { not: null } }, orderBy: { receivedAt: "asc" }, take: 500 });
  if (!events.length) return 0;
  const min = Math.min(...events.map((event) => event.occurredAt!.getTime())) - 3 * 86_400_000;
  const max = Math.max(...events.map((event) => event.occurredAt!.getTime())) + 3 * 86_400_000;
  const movements = await tx.transaction.findMany({ where: { userId, accountId, amount: { in: events.map((event) => event.amount!) }, date: { gte: new Date(min), lte: new Date(max) }, bankNotification: null }, select: { id: true, amount: true, date: true, concept: true, cleanDescription: true, raw: true } });
  const byAmount = new Map<number, typeof movements>();
  for (const movement of movements) {
    const key = cents(movement.amount), bucket = byAmount.get(key) ?? [];
    bucket.push(movement); byAmount.set(key, bucket);
  }
  const candidates = events.map((event) => ({ event, matches: (byAmount.get(cents(event.amount!)) ?? []).filter((movement) => matchesNotification(event, movement)) }));
  const claimed = new Map<string, number>();
  for (const candidate of candidates) for (const match of candidate.matches) claimed.set(match.id, (claimed.get(match.id) ?? 0) + 1);
  let count = 0;
  for (const { event, matches } of candidates) {
    if (eventId && event.id !== eventId) continue;
    if (matches.length !== 1 || claimed.get(matches[0].id) !== 1) continue;
    await tx.bankNotification.update({ where: { id: event.id }, data: { status: "RECONCILED", transactionId: matches[0].id, reason: "Conciliado con un movimiento bancario único; se conserva la notificación original." } });
    count++;
  }
  return count;
}

export async function readNotificationJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("Cuerpo vacío.");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 16384) { await reader.cancel(); throw new InputError("La notificación supera 16 KB.", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new InputError("JSON inválido."); }
}
