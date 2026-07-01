import { NextResponse } from "next/server";
import { Role, TransactionType } from "@prisma/client";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { recalculateMonthlySummaries } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

type TransactionBody = {
  concept?: string;
  categoryId?: string | null;
  date?: string;
  amount?: number;
  type?: TransactionType;
};

async function authorizeTransaction(id: string) {
  const session = await requireUser();
  const transaction = await prisma.transaction.findUnique({ where: { id } });

  if (!transaction) {
    return { error: NextResponse.json({ error: "Movimiento no encontrado." }, { status: 404 }) };
  }

  if (transaction.userId !== session.user.id && session.user.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: "No puedes editar este movimiento." }, { status: 403 }) };
  }

  return { session, transaction };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authorized = await authorizeTransaction(id);
    if (authorized.error) {
      return authorized.error;
    }

    const body = await readJson<TransactionBody>(request);
    const data = {
      concept: body.concept?.trim() || undefined,
      categoryId: body.categoryId === null ? null : body.categoryId || undefined,
      date: body.date ? new Date(body.date) : undefined,
      amount: typeof body.amount === "number" ? body.amount : undefined,
      type: body.type
    };

    const updated = await prisma.transaction.update({
      where: { id },
      data,
      include: { category: true }
    });

    await recalculateMonthlySummaries(updated.userId);
    return NextResponse.json({ transaction: updated });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el movimiento.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authorized = await authorizeTransaction(id);
    if (authorized.error) {
      return authorized.error;
    }

    await prisma.transaction.delete({ where: { id } });
    await recalculateMonthlySummaries(authorized.transaction.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar el movimiento.");
  }
}
