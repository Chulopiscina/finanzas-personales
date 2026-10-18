import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { InputError } from "@/lib/input-error";
import { requireShortcuts } from "@/lib/shortcuts";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(); requireShortcuts();
    const url = new URL(request.url), id = url.searchParams.get("id");
    const event = id ? await prisma.bankNotification.findFirst({ where: { id, userId: user.id } }) : null;
    if (!event) throw new InputError("Notificación no encontrada.", 404);
    const search = url.searchParams.get("search")?.trim().slice(0, 100);
    const candidates = await prisma.transaction.findMany({ where: { userId: user.id, accountId: event.accountId, bankNotification: null,
      ...(search ? { OR: [{ concept: { contains: search, mode: "insensitive" } }, { cleanDescription: { contains: search, mode: "insensitive" } }] }
        : event.occurredAt ? { date: { gte: new Date(event.occurredAt.getTime() - 7 * 86_400_000), lt: new Date(event.occurredAt.getTime() + 8 * 86_400_000) } } : {}) },
      select: { id: true, date: true, concept: true, cleanDescription: true, amount: true }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 30 });
    return NextResponse.json({ candidates });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser(); requireShortcuts();
    const input = await readJson<{ id?: string; action?: string; transactionId?: string; confirmed?: boolean }>(request);
    if (typeof input.id !== "string") throw new InputError("Notificación obligatoria.");
    const id = input.id;
    const event = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${id}))`;
      const event = await tx.bankNotification.findFirst({ where: { id, userId: user.id } });
      if (!event) throw new InputError("Notificación no encontrada.", 404);
      if (input.action === "link") {
        if (input.confirmed !== true || typeof input.transactionId !== "string") throw new InputError("Confirma el vínculo con el cargo definitivo.");
        const movement = await tx.transaction.findFirst({ where: { id: input.transactionId, userId: user.id, accountId: event.accountId } });
        if (!movement) throw new InputError("El movimiento debe pertenecer a la misma cuenta y usuario.");
        await tx.bankNotification.update({ where: { id }, data: { transactionId: movement.id, status: "RECONCILED", reason: "Vínculo confirmado manualmente con el movimiento definitivo; no se modifica su importe." } });
      } else if (input.action === "dismiss" || input.action === "unlink") {
        await tx.bankNotification.update({ where: { id }, data: { transactionId: null, status: input.action === "dismiss" ? "DISMISSED" : "REVIEW", reason: input.action === "dismiss" ? "Descartada por el usuario; original conservado." : "Vínculo retirado por el usuario; pendiente de revisión." } });
      } else throw new InputError("Acción no compatible.");
      return tx.bankNotification.findUniqueOrThrow({ where: { id }, select: { id: true, status: true, transactionId: true, reason: true } });
    });
    return NextResponse.json({ ok: true, event });
  } catch (error) { return jsonError(error); }
}
