import { NextResponse } from "next/server";
import { Role, TransactionType } from "@prisma/client";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { recalculateMonthlySummaries, toNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

type ReimbursementBody = { expenseIds?: string[] };

async function authorizeTransaction(id: string) {
  const session = await requireUser();
  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction) return { error: NextResponse.json({ error: "Movimiento no encontrado." }, { status: 404 }) };
  if (transaction.userId !== session.user.id && session.user.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: "No puedes editar este movimiento." }, { status: 403 }) };
  }
  return { session, transaction };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authorized = await authorizeTransaction(id);
    if (authorized.error) return authorized.error;

    if (authorized.transaction.type !== TransactionType.INCOME || toNumber(authorized.transaction.amount) <= 0 || authorized.transaction.isInternalTransfer) {
      return NextResponse.json({ error: "Solo puedes marcar ingresos positivos reales como reembolso." }, { status: 400 });
    }

    const body = await readJson<ReimbursementBody>(request);
    const expenseIds = [...new Set(body.expenseIds ?? [])];
    if (expenseIds.length > 0) {
      const expenses = await prisma.transaction.findMany({
        where: {
          id: { in: expenseIds },
          userId: authorized.transaction.userId,
          type: TransactionType.EXPENSE,
          isInternalTransfer: false
        },
        select: { id: true }
      });
      if (expenses.length !== expenseIds.length) {
        return NextResponse.json({ error: "Algún gasto seleccionado no es válido." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.transactionReimbursement.deleteMany({ where: { reimbursementId: id } });
      if (expenseIds.length > 0) {
        await tx.transactionReimbursement.createMany({ data: expenseIds.map((expenseId) => ({ reimbursementId: id, expenseId })) });
      }
    });

    const links = await prisma.transactionReimbursement.findMany({
      where: { reimbursementId: id },
      include: { expense: { include: { account: true, category: true } } },
      orderBy: { createdAt: "asc" }
    });
    await recalculateMonthlySummaries(authorized.transaction.userId);
    return NextResponse.json({ reimbursements: links });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el reembolso.");
  }
}