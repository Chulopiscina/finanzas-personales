import { NextResponse } from "next/server";
import { Role, TransactionType } from "@prisma/client";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { recalculateMonthlySummaries, toNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

type TransactionBody = {
  concept?: string;
  cleanDescription?: string | null;
  categoryId?: string | null;
  accountId?: string;
  date?: string;
  amount?: number;
  type?: TransactionType;
  isInternalTransfer?: boolean;
  internalTransferCounterAccountId?: string | null;
  counterpartTransactionId?: string | null;
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

function transferTolerance(amount: number) {
  return Math.max(1, Math.abs(amount) * 0.001);
}

async function linkManualInternalTransferPair(transactionId: string, counterpartId: string) {
  const [transaction, counterpart] = await Promise.all([
    prisma.transaction.findUnique({ where: { id: transactionId } }),
    prisma.transaction.findUnique({ where: { id: counterpartId } })
  ]);

  if (!transaction || !counterpart || transaction.userId !== counterpart.userId || transaction.accountId === counterpart.accountId) {
    return null;
  }

  const groupId = `internal-${[transaction.id, counterpart.id].sort().join("-")}`;
  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        type: TransactionType.TRANSFER,
        isInternalTransfer: true,
        internalTransferGroupId: groupId,
        internalTransferCounterAccountId: counterpart.accountId
      }
    }),
    prisma.transaction.update({
      where: { id: counterpart.id },
      data: {
        type: TransactionType.TRANSFER,
        isInternalTransfer: true,
        internalTransferGroupId: groupId,
        internalTransferCounterAccountId: transaction.accountId
      }
    })
  ]);

  return groupId;
}

async function pairManualInternalTransfer(transactionId: string) {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction?.isInternalTransfer || !transaction.internalTransferCounterAccountId) {
    return null;
  }

  const amount = toNumber(transaction.amount);
  if (amount === 0) {
    return null;
  }

  const tolerance = transferTolerance(amount);
  const target = -amount;
  const start = new Date(transaction.date.getTime() - 7 * 86_400_000);
  const end = new Date(transaction.date.getTime() + 7 * 86_400_000);
  const counterpart = await prisma.transaction.findFirst({
    where: {
      userId: transaction.userId,
      id: { not: transaction.id },
      accountId: transaction.internalTransferCounterAccountId,
      date: { gte: start, lte: end },
      amount: { gte: target - tolerance, lte: target + tolerance }
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }]
  });

  if (!counterpart) {
    return null;
  }

  const groupId = `internal-${[transaction.id, counterpart.id].sort().join("-")}`;
  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        type: TransactionType.TRANSFER,
        isInternalTransfer: true,
        internalTransferGroupId: groupId,
        internalTransferCounterAccountId: counterpart.accountId
      }
    }),
    prisma.transaction.update({
      where: { id: counterpart.id },
      data: {
        type: TransactionType.TRANSFER,
        isInternalTransfer: true,
        internalTransferGroupId: groupId,
        internalTransferCounterAccountId: transaction.accountId
      }
    })
  ]);

  return groupId;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authorized = await authorizeTransaction(id);
    if (authorized.error) {
      return authorized.error;
    }

    const body = await readJson<TransactionBody>(request);
    let explicitCounterpartId: string | null = null;
    if (body.accountId) {
      const account = await prisma.account.findUnique({ where: { id: body.accountId } });
      if (!account || account.userId !== authorized.transaction.userId || account.isArchived) {
        return NextResponse.json({ error: "La cuenta seleccionada no es valida." }, { status: 400 });
      }
    }

    if (body.internalTransferCounterAccountId) {
      const counterAccount = await prisma.account.findUnique({ where: { id: body.internalTransferCounterAccountId } });
      if (!counterAccount || counterAccount.userId !== authorized.transaction.userId || counterAccount.id === (body.accountId ?? authorized.transaction.accountId)) {
        return NextResponse.json({ error: "La cuenta contraria no es valida." }, { status: 400 });
      }
    }

    if (body.counterpartTransactionId) {
      const counterpart = await prisma.transaction.findUnique({ where: { id: body.counterpartTransactionId } });
      const nextAccountId = body.accountId ?? authorized.transaction.accountId;
      if (!counterpart || counterpart.userId !== authorized.transaction.userId || counterpart.id === id || counterpart.accountId === nextAccountId) {
        return NextResponse.json({ error: "La contrapartida seleccionada no es valida." }, { status: 400 });
      }

      if (body.internalTransferCounterAccountId && body.internalTransferCounterAccountId !== counterpart.accountId) {
        return NextResponse.json({ error: "La contrapartida no pertenece a la cuenta seleccionada." }, { status: 400 });
      }

      explicitCounterpartId = counterpart.id;
      body.internalTransferCounterAccountId = counterpart.accountId;
    }

    if (body.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: body.categoryId, OR: [{ userId: null }, { userId: authorized.transaction.userId }] }
      });
      if (!category || category.isArchived) {
        return NextResponse.json({ error: "La categoria seleccionada no es valida." }, { status: 400 });
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
        type: body.isInternalTransfer === true ? TransactionType.TRANSFER : body.type,
        isInternalTransfer: typeof body.isInternalTransfer === "boolean" ? body.isInternalTransfer : undefined,
        internalTransferCounterAccountId: body.isInternalTransfer === false ? null : body.internalTransferCounterAccountId === null ? null : body.internalTransferCounterAccountId || undefined,
        internalTransferGroupId: body.isInternalTransfer === false ? null : body.isInternalTransfer === true ? `manual-${id}` : undefined
      }
    });

    if (body.isInternalTransfer === true) {
      if (explicitCounterpartId) {
        await linkManualInternalTransferPair(updated.id, explicitCounterpartId);
      } else {
        await pairManualInternalTransfer(updated.id);
      }
    }

    if (body.isInternalTransfer === false && authorized.transaction.internalTransferGroupId) {
      await prisma.transaction.updateMany({
        where: { userId: authorized.transaction.userId, internalTransferGroupId: authorized.transaction.internalTransferGroupId },
        data: { isInternalTransfer: false, internalTransferGroupId: null, internalTransferCounterAccountId: null }
      });
    }

    const result = await prisma.transaction.findUniqueOrThrow({
      where: { id: updated.id },
      include: { category: true, account: true, importHistory: { select: { id: true, fileName: true } } }
    });

    await recalculateMonthlySummaries(result.userId);
    return NextResponse.json({ transaction: result });
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
