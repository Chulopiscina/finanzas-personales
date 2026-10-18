import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUserId, requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { accountingType } from "@/lib/ledger";
import { parseSpanishDate } from "@/lib/csv";

function toNumber(value: unknown) {
  return Number(value && typeof value === "object" && "toString" in value ? value.toString() : value);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireUser();
    const userId = getAuthorizedUserId(session.user, request.nextUrl.searchParams.get("userId"));
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const categoryId = params.get("categoryId") || undefined;
    const requested = Number(params.get("page") ?? 1);
    const page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
    const pageSize = params.get("pageSize") === "25" ? 25 : 50;
    const type = params.get("type"), goal = params.get("planningGoalId");
    const where: Prisma.TransactionWhereInput = {
      userId, categoryId, accountId: params.get("accountId") || undefined,
      importHistoryId: params.get("importId") || undefined,
      ...(q ? { OR: [{ concept: { contains: q, mode: "insensitive" } }, { cleanDescription: { contains: q, mode: "insensitive" } }] } : {}),
      ...(type === "TRANSFER" ? { isInternalTransfer: true } : type === "INCOME" || type === "EXPENSE" ? { isInternalTransfer: false, amount: type === "INCOME" ? { gte: 0 } : { lt: 0 } } : {}),
      ...(goal === "__none" ? { planningGoals: { none: {} } } : goal === "__any" ? { planningGoals: { some: {} } } : goal ? { planningGoals: { some: { goalId: goal } } } : {}),
      date: { ...(params.get("start") ? { gte: parseSpanishDate(params.get("start")!) } : {}), ...(params.get("end") ? { lt: parseSpanishDate(params.get("end")!) } : {}) }
    };

    const [transactions, categories, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: { id: true, date: true, concept: true, cleanDescription: true, amount: true, balance: true, type: true,
          accountId: true, categoryId: true, category: true, isInternalTransfer: true, isFixedExpense: true, createdAt: true, updatedAt: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize, take: pageSize
      }),
      prisma.category.findMany({ where: { OR: [{ userId: null }, { userId }], isArchived: false }, select: { id: true, name: true, color: true, icon: true, type: true }, orderBy: { name: "asc" } }),
      prisma.transaction.count({ where })
    ]);

    return NextResponse.json({
      categories,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      transactions: transactions.map((tx) => ({
        ...tx,
        type: accountingType(tx),
        amount: toNumber(tx.amount),
        balance: tx.balance === null ? null : toNumber(tx.balance),
        date: tx.date.toISOString(),
        createdAt: tx.createdAt.toISOString(),
        updatedAt: tx.updatedAt.toISOString()
      }))
    });
  } catch (error) {
    return jsonError(error, "No se pudieron cargar los movimientos.");
  }
}
