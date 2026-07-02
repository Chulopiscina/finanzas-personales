import { NextResponse } from "next/server";
import { Role, TransactionType } from "@prisma/client";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { recalculateMonthlySummaries } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

type TransactionBody = {
  concept?: string;
  cleanDescription?: string | null;
  categoryId?: string | null;
  accountId?: string;
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
    if (body.accountId) {
      const account = await prisma.account.findUnique({ where: { id: body.accountId } });
      if (!account || account.userId !== authorized.transaction.userId || account.isArchived) {
        return NextResponse.json({ error: "La cuenta seleccionada no es válida." }, { status: 400 });
      }
    }

    if (body.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: body.categoryId, OR: [{ userId: null }, { userId: authorized.transaction.userId }] }
      });
      if (!category || category.isArchived) {
        return NextResponse.json({ error: "La categoría seleccionada no es válida." }, { status: 400 });
      }
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        concept: body.concept?.trim() || undefined,
        cleanDescription: body.cleanDescription === null ? null : body.cleanDescription?.trim() || undefined,
        categoryId: body.categoryId === null ? null : body.categoryId || undefined,
        accountId: body.accountId || undefined,
        date: body.date ? new Date(body.date) : undefined,
        amount: typeof body.amount === "number" ? body.amount : undefined,
        type: body.type
      },
      include: { category: true, account: true, importHistory: { select: { id: true, fileName: true } } }
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