import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { accountingType } from "@/lib/ledger";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser(); const { id } = await params;
    const source = await prisma.transaction.findFirst({ where: { id, ...(user.role === "ADMIN" ? {} : { userId: user.id }) } });
    if (!source) return NextResponse.json({ error: "Movimiento no encontrado." }, { status: 404 });
    const kind = request.nextUrl.searchParams.get("kind");
    const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (kind === "transfer" && (!accountId || !await prisma.account.findFirst({ where: { id: accountId, userId: source.userId, isArchived: false } }))) return NextResponse.json({ error: "Cuenta no válida." }, { status: 400 });
    const where: Prisma.TransactionWhereInput = { userId: source.userId, id: { not: id }, isInternalTransfer: false,
      ...(kind === "transfer" ? { accountId: accountId!, amount: -Number(source.amount), reimbursementLinks: { none: {} }, reimbursedByLinks: { none: {} }, ...(!q ? { date: { gte: new Date(source.date.getTime() - 14 * 86400000), lte: new Date(source.date.getTime() + 14 * 86400000) } } : {}) } : { amount: { lt: 0 } }),
      ...(q ? { OR: [{ concept: { contains: q, mode: "insensitive" } }, { cleanDescription: { contains: q, mode: "insensitive" } }] } : {}) };
    const [rows, linked] = await Promise.all([
      prisma.transaction.findMany({ where, include: { account: { select: { id: true, name: true } }, category: true }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 50 }),
      kind !== "transfer" ? prisma.transaction.findMany({ where: { userId: source.userId, reimbursedByLinks: { some: { reimbursementId: id } } }, include: { account: { select: { id: true, name: true } }, category: true } }) : []
    ]);
    return NextResponse.json({ candidates: [...new Map([...linked, ...rows].map((row) => [row.id, row])).values()].map((row) => ({ id: row.id, date: row.date.toISOString(), concept: row.concept, cleanDescription: row.cleanDescription, amount: Number(row.amount), type: accountingType(row), accountId: row.accountId, account: row.account, category: row.category })) });
  } catch (error) { return jsonError(error, "No se pudieron cargar candidatos."); }
}
