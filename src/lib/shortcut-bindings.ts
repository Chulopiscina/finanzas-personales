import { prisma } from "@/lib/prisma";
import { InputError } from "@/lib/input-error";
import { notificationBank } from "@/lib/notification-banks";
import { requireShortcuts } from "@/lib/shortcuts";

export async function setShortcutBinding(userId: string, deviceId: string, bankId: string, accountId: string | null) {
  requireShortcuts(); notificationBank(bankId);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${"pairing:" + userId}))`;
    const device = await tx.shortcutDevice.findFirst({ where: { id: deviceId, userId, isUniversal: true, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!device) throw new InputError("Atajo universal no disponible.", 404);
    // Serialize routing changes with receipt; old events retain their original account.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${device.tokenHash}))`;
    if (accountId === null) {
      await tx.shortcutBankBinding.deleteMany({ where: { userId, deviceId, bankId } });
    } else {
      if (!await tx.account.findFirst({ where: { id: accountId, userId, currency: "EUR", isArchived: false } })) throw new InputError("Selecciona una cuenta propia activa en EUR.");
      await tx.shortcutBankBinding.upsert({ where: { deviceId_bankId: { deviceId, bankId } }, create: { userId, deviceId, bankId, accountId }, update: { accountId, userId } });
    }
    return tx.shortcutBankBinding.findMany({ where: { userId, deviceId }, select: { bankId: true, accountId: true, account: { select: { name: true, isArchived: true } } }, orderBy: { bankId: "asc" } });
  });
}

export async function assignNotificationAccount(userId: string, id: string, accountId: string) {
  requireShortcuts();
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${id}))`;
    const event = await tx.bankNotification.findFirst({ where: { id, userId } });
    if (!event) throw new InputError("Notificación no encontrada.", 404);
    if (event.transactionId) throw new InputError("Quita primero el vínculo con el movimiento definitivo.");
    if (event.accountId) throw new InputError("La notificación ya tiene cuenta. Esta acción solo asigna avisos sin cuenta.");
    const account = await tx.account.findFirst({ where: { id: accountId, userId, isArchived: false, currency: "EUR" } });
    if (!account) throw new InputError("Selecciona una cuenta propia activa en EUR.");
    const updated = await tx.bankNotification.update({ where: { id }, data: { accountId, status: ["AUTHORIZATION", "REVERSED"].includes(event.status) ? event.status : "REVIEW", reason: "Cuenta asignada manualmente. Revisa y concilia con el extracto; no se ha creado ni modificado ningún movimiento." }, select: { id: true, status: true, reason: true, accountId: true } });
    return { ...updated, account: account.name };
  });
}
