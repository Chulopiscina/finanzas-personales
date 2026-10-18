import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { InputError } from "@/lib/input-error";
import { accountingType } from "@/lib/ledger";
import { cents } from "@/lib/money";
import { parseSpanishDate } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

type TransactionBody = {
  concept?: string; cleanDescription?: string | null; categoryId?: string | null;
  accountId?: string; date?: string; amount?: number; isInternalTransfer?: boolean;
  isFixedExpense?: boolean; internalTransferCounterAccountId?: string | null; counterpartTransactionId?: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const body = await readJson<TransactionBody>(request);
    const result = await prisma.$transaction(async (tx) => {
      const original = await tx.transaction.findFirst({ where: { id, ...(session.user.role === Role.ADMIN ? {} : { userId: session.user.id }) }, include: { reimbursementLinks: true, reimbursedByLinks: true } });
      if (!original) throw new InputError("Movimiento no encontrado.", 404);
      const owner = original.userId;
      const accountId = body.accountId ?? original.accountId;
      if (body.accountId) {
        const account = await tx.account.findFirst({ where: { id: accountId, userId: owner, isArchived: false } });
        if (!account) throw new InputError("La cuenta seleccionada no es válida.");
        if (original.isInternalTransfer && accountId !== original.accountId) throw new InputError("Quita primero la transferencia interna antes de cambiar de cuenta.");
      }
      if (body.categoryId) {
        const category = await tx.category.findFirst({ where: { id: body.categoryId, OR: [{ userId: owner }, { userId: null }], isArchived: false } });
        if (!category) throw new InputError("La categoría seleccionada no es válida.");
      }
      const amount = body.amount ?? original.amount;
      cents(amount);
      if (body.amount !== undefined && (typeof body.amount !== "number" || Math.abs(body.amount) >= 10_000_000_000)) throw new InputError("Importe no válido.");
      if (cents(amount) !== cents(original.amount) && (original.internalTransferGroupId?.startsWith("internal-") || original.reimbursementLinks.length || original.reimbursedByLinks.length)) {
        throw new InputError("Quita primero el vínculo de transferencia o reembolso antes de cambiar el importe.");
      }
      const internal = body.isInternalTransfer ?? original.isInternalTransfer;
      if (internal && (original.reimbursementLinks.length || original.reimbursedByLinks.length)) throw new InputError("Quita primero las relaciones de reembolso antes de marcar una transferencia.");
      if (original.internalTransferGroupId?.startsWith("internal-") && body.isInternalTransfer === true) throw new InputError("Quita el vínculo anterior antes de seleccionar otra contrapartida.");
      let counterpart = null;
      let counterAccountId = body.internalTransferCounterAccountId ?? original.internalTransferCounterAccountId;
      if (internal) {
        if (body.counterpartTransactionId) {
          counterpart = await tx.transaction.findFirst({ where: { id: body.counterpartTransactionId, userId: owner }, include: { reimbursementLinks: true, reimbursedByLinks: true } });
          if (!counterpart || counterpart.id === id || counterpart.accountId === accountId || cents(counterpart.amount) !== -cents(amount) || counterpart.isInternalTransfer || counterpart.reimbursementLinks.length || counterpart.reimbursedByLinks.length) throw new InputError("La contrapartida debe ser libre, de la misma cantidad y signo opuesto en otra cuenta propia.");
          if (counterAccountId && counterAccountId !== counterpart.accountId) throw new InputError("La contrapartida no corresponde a la cuenta seleccionada.");
          counterAccountId = counterpart.accountId;
        }
        const account = counterAccountId && await tx.account.findFirst({ where: { id: counterAccountId, userId: owner, isArchived: false } });
        if (!account || counterAccountId === accountId || cents(amount) === 0) throw new InputError("Selecciona otra cuenta propia activa y un importe distinto de cero.");
      }
      if (body.isInternalTransfer === false && original.internalTransferGroupId) {
        const members = await tx.transaction.findMany({ where: { userId: owner, internalTransferGroupId: original.internalTransferGroupId }, select: { id: true, amount: true } });
        for (const member of members) await tx.transaction.update({ where: { id: member.id }, data: { type: accountingType({ amount: member.amount, isInternalTransfer: false }), isInternalTransfer: false, internalTransferGroupId: null, internalTransferCounterAccountId: null } });
      }
      const group = counterpart ? `internal-${[id, counterpart.id].sort().join("-")}` : original.internalTransferGroupId ?? `manual-${id}`;
      const updated = await tx.transaction.update({ where: { id }, data: {
        concept: typeof body.concept === "string" ? body.concept.trim().slice(0, 1000) || undefined : undefined,
        cleanDescription: body.cleanDescription === null ? null : typeof body.cleanDescription === "string" ? body.cleanDescription.trim().slice(0, 1000) : undefined,
        categoryId: body.categoryId === null ? null : body.categoryId || undefined,
        accountId, amount, date: body.date ? parseSpanishDate(body.date) : undefined,
        ...(body.date || body.amount !== undefined || accountId !== original.accountId ? { balance: null } : {}),
        type: accountingType({ amount, isInternalTransfer: internal }), isInternalTransfer: internal,
        isFixedExpense: !internal && cents(amount) < 0 ? body.isFixedExpense ?? original.isFixedExpense : false,
        internalTransferGroupId: internal ? group : null, internalTransferCounterAccountId: internal ? counterAccountId : null
      }, include: { category: true, account: { select: { id: true, name: true } }, importHistory: { select: { id: true, fileName: true } } } });
      if (counterpart) await tx.transaction.update({ where: { id: counterpart.id }, data: { type: "TRANSFER", isInternalTransfer: true, isFixedExpense: false, internalTransferGroupId: group, internalTransferCounterAccountId: accountId } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ transaction: { ...result, amount: Number(result.amount), balance: result.balance === null ? null : Number(result.balance) } });
  } catch (error) { return jsonError(error, "No se pudo actualizar el movimiento."); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(); const { id } = await params;
    await prisma.$transaction(async (tx) => {
      const original = await tx.transaction.findFirst({ where: { id, ...(session.user.role === Role.ADMIN ? {} : { userId: session.user.id }) } });
      if (!original) throw new InputError("Movimiento no encontrado.", 404);
      if (original.internalTransferGroupId) {
        const members = await tx.transaction.findMany({ where: { userId: original.userId, internalTransferGroupId: original.internalTransferGroupId } });
        for (const member of members) await tx.transaction.update({ where: { id: member.id }, data: { type: accountingType({ amount: member.amount, isInternalTransfer: false }), isInternalTransfer: false, internalTransferGroupId: null, internalTransferCounterAccountId: null } });
      }
      await tx.transaction.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return jsonError(error, "No se pudo eliminar el movimiento."); }
}
