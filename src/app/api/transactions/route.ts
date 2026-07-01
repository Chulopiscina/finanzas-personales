import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUserId, requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function toNumber(value: unknown) {
  return Number(value && typeof value === "object" && "toString" in value ? value.toString() : value);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireUser();
    const userId = getAuthorizedUserId(session.user, request.nextUrl.searchParams.get("userId"));
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const categoryId = request.nextUrl.searchParams.get("categoryId") ?? undefined;

    const [transactions, categories] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          categoryId,
          concept: q ? { contains: q, mode: "insensitive" } : undefined
        },
        include: { category: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 200
      }),
      prisma.category.findMany({ orderBy: { name: "asc" } })
    ]);

    return NextResponse.json({
      categories,
      transactions: transactions.map((tx) => ({
        ...tx,
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
