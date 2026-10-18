import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shortcutsEnabled } from "@/lib/shortcuts";
import { NotificationsManager } from "@/components/notifications-manager";
import { shortcutInstallConfig } from "@/lib/shortcut-install";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; pairing?: string }> }) {
  const session = await getSessionUser();
  if (!session) return null;
  if (!shortcutsEnabled()) return <section className="space-y-4"><h1 className="text-2xl font-semibold">Notificaciones</h1><p className="text-muted-foreground">Integración pendiente de activación y migración autorizada. Los datos financieros existentes no se modifican.</p><Link className="text-accent underline" href="/dashboard">Volver al dashboard</Link></section>;
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Math.trunc(Number(params.page) || 1)));
  const userId = session.user.id;
  const [accounts, devices, events, total] = await Promise.all([
    prisma.account.findMany({ where: { userId, isArchived: false, currency: "EUR" }, select: { id: true, name: true } }),
    prisma.shortcutDevice.findMany({ where: { userId }, select: { id: true, name: true, revokedAt: true, expiresAt: true, lastVerifiedAt: true, lastUsedAt: true, account: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.bankNotification.findMany({ where: { userId }, select: { id: true, body: true, title: true, receivedAt: true, occurredAt: true, amount: true, currency: true, merchant: true, categoryName: true, status: true, reason: true, transactionId: true, account: { select: { name: true } } }, orderBy: [{ receivedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 25 }),
    prisma.bankNotification.count({ where: { userId } })
  ]);
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold">Notificaciones</h1>
    <p className="text-sm text-muted-foreground">Provisionales: no se incluyen en saldos, gastos ni ciclos de nómina.</p>
    <NotificationsManager accounts={accounts} installUrl={shortcutInstallConfig().installUrl} initialPairingId={typeof params.pairing === "string" && params.pairing.length <= 100 ? params.pairing : undefined} devices={devices.map((device) => ({ id: device.id, name: device.name, account: device.account.name, revoked: Boolean(device.revokedAt), expiresAt: device.expiresAt.toISOString(), lastVerifiedAt: device.lastVerifiedAt?.toISOString() ?? null, lastUsedAt: device.lastUsedAt?.toISOString() ?? null }))} events={events.map((event) => ({ ...event, status: event.status === "RECONCILED" && !event.transactionId ? "REVIEW" : event.status, reason: event.status === "RECONCILED" && !event.transactionId ? "El movimiento vinculado fue eliminado. Requiere revisión." : event.reason, amount: event.amount === null ? null : Number(event.amount), account: event.account.name, receivedAt: event.receivedAt.toISOString(), occurredAt: event.occurredAt?.toISOString() ?? null }))} />
    <nav className="flex items-center justify-between text-sm" aria-label="Paginación de notificaciones">
      {page > 1 ? <Link href={`/notifications?page=${page - 1}`} className="text-accent underline">Anterior</Link> : <span />}
      <span>{page} / {Math.max(1, Math.ceil(total / 25))}</span>
      {page * 25 < total ? <Link href={`/notifications?page=${page + 1}`} className="text-accent underline">Siguiente</Link> : <span />}
    </nav>
  </div>;
}
