import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthorizedUserId, requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { InputError } from "@/lib/input-error";
import { prisma } from "@/lib/prisma";
import { accountingType, isRefund } from "@/lib/ledger";
import { parseSpanishDate } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser(); const params = request.nextUrl.searchParams;
    const userId = getAuthorizedUserId(user, params.get("userId"));
    const accounts = await prisma.account.findMany({ where: { userId, ...(params.get("accountId") ? { id: params.get("accountId")! } : { isArchived: false }) }, select: { id: true } });
    const kind = params.get("kind");
    const refund: Prisma.TransactionWhereInput = { amount: { gt: 0 }, reimbursementLinks: { some: {} } };
    let filter: Prisma.TransactionWhereInput = { isInternalTransfer: false };
    if (kind === "realIncome") filter = { ...filter, amount: { gt: 0 }, reimbursementLinks: { none: {} } };
    else if (kind === "grossExpenses") filter = { ...filter, amount: { lt: 0 } };
    else if (kind === "reimbursements") filter = { ...filter, ...refund };
    else if (kind === "netExpenses" || kind === "averageMonthlyNetExpense") filter = { ...filter, OR: [{ amount: { lt: 0 } }, refund] };
    else if (kind === "internalTransfers") filter = { isInternalTransfer: true };
    else if (kind === "uncategorized") filter = { ...filter, categoryId: null };
    else if (kind === "topCategory") filter = { ...filter, OR: [{ amount: { lt: 0 }, category: { name: params.get("category") ?? "" } }, { reimbursementLinks: { some: { expense: { category: { name: params.get("category") ?? "" } } } } }] };
    else if (kind !== "periodResult") throw new InputError("Detalle no válido.");
    const requested = Number(params.get("page") ?? 1); const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
    const where: Prisma.TransactionWhereInput = { userId, accountId: { in: accounts.map((a) => a.id) }, ...filter,
      date: { ...(params.get("start") ? { gte: parseSpanishDate(params.get("start")!) } : {}), ...(params.get("end") ? { lt: parseSpanishDate(params.get("end")!) } : {}) } };
    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({ where, include: { category: true, account: { select: { name: true } }, reimbursementLinks: { include: { expense: { select: { concept: true, cleanDescription: true } } } }, reimbursedByLinks: { include: { reimbursement: { select: { concept: true, cleanDescription: true } } } } }, orderBy: [{ date: "desc" }, { id: "desc" }], skip: (page - 1) * 50, take: 50 }),
      prisma.transaction.count({ where })
    ]);
    return NextResponse.json({ total, rows: rows.map((row) => ({ id: row.id, date: row.date.toISOString(), concept: row.cleanDescription || row.concept, account: row.account.name, category: row.category?.name ?? "Sin categoría", amount: Number(row.amount), type: accountingType(row), isInternalTransfer: row.isInternalTransfer, isReimbursement: isRefund({ ...row, reimbursementLinks: row.reimbursementLinks.map((link) => ({ expenseId: link.expenseId })) }), linkedMovements: [...row.reimbursementLinks.map((link) => link.expense.cleanDescription || link.expense.concept), ...row.reimbursedByLinks.map((link) => link.reimbursement.cleanDescription || link.reimbursement.concept)] })) });
  } catch (error) { return jsonError(error, "No se pudo cargar el detalle."); }
}
