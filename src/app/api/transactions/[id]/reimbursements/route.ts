import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { InputError } from "@/lib/input-error";
import { refundShares } from "@/lib/ledger";
import { cents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser(); const { id } = await params;
    const body = await readJson<{ expenseIds?: string[] }>(request);
    if (!Array.isArray(body.expenseIds) || body.expenseIds.length > 100 || body.expenseIds.some((item) => typeof item !== "string")) throw new InputError("Selecciona una lista válida de gastos.");
    const expenseIds = [...new Set(body.expenseIds)];
    const links = await prisma.$transaction(async (tx) => {
      const reimbursement = await tx.transaction.findFirst({ where: { id, ...(user.role === "ADMIN" ? {} : { userId: user.id }) } });
      if (!reimbursement) throw new InputError("Movimiento no encontrado.", 404);
      if (cents(reimbursement.amount) <= 0 || reimbursement.isInternalTransfer) throw new InputError("Solo puedes marcar ingresos positivos reales como reembolso.");
      const expenses = await tx.transaction.findMany({ where: { id: { in: expenseIds }, userId: reimbursement.userId, amount: { lt: 0 }, isInternalTransfer: false } });
      if (expenses.length !== expenseIds.length) throw new InputError("Algún gasto seleccionado no es válido.");
      const refunds = await tx.transaction.findMany({ where: { userId: reimbursement.userId, id: { not: id }, isInternalTransfer: false, amount: { gt: 0 }, reimbursementLinks: { some: { expenseId: { in: expenseIds } } } }, include: { reimbursementLinks: { include: { expense: true } } } });
      const allocated = new Map<string, number>();
      for (const refund of [...refunds, { ...reimbursement, reimbursementLinks: expenses.map((expense) => ({ expenseId: expense.id, expense })) }]) {
        for (const share of refundShares(refund)) allocated.set(share.expense.id, (allocated.get(share.expense.id) ?? 0) + cents(share.amount));
      }
      if (expenses.some((expense) => (allocated.get(expense.id) ?? 0) > Math.abs(cents(expense.amount)))) throw new InputError("Los reembolsos asignados superarían el importe de alguno de los gastos. Revisa los vínculos.");
      await tx.transactionReimbursement.deleteMany({ where: { reimbursementId: id } });
      if (expenseIds.length) await tx.transactionReimbursement.createMany({ data: expenseIds.map((expenseId) => ({ reimbursementId: id, expenseId })) });
      return tx.transactionReimbursement.findMany({ where: { reimbursementId: id }, include: { expense: { include: { account: { select: { id: true, name: true } }, category: true } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ reimbursements: links });
  } catch (error) { return jsonError(error, "No se pudo actualizar el reembolso."); }
}
