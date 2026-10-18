import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { lockImportAccount } from "@/lib/import-service";
import { prisma } from "@/lib/prisma";

type DeleteBody = {
  deleteTransactions?: boolean;
};

async function authorizeImport(id: string) {
  const session = await requireUser();
  const imported = await prisma.importHistory.findUnique({ where: { id } });
  if (!imported) {
    return { error: NextResponse.json({ error: "Extracto no encontrado." }, { status: 404 }) };
  }
  if (imported.userId !== session.user.id && session.user.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: "No puedes modificar este extracto." }, { status: 403 }) };
  }
  return { session, imported };
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authorized = await authorizeImport(id);
    if (authorized.error) {
      return authorized.error;
    }

    const body = await readJson<DeleteBody>(request).catch(() => ({ deleteTransactions: false }));
    const deleteTransactions = body.deleteTransactions === true;
    await prisma.$transaction(async (tx) => {
      await lockImportAccount(tx, authorized.imported.userId, authorized.imported.accountId);
      if (deleteTransactions) await tx.transaction.deleteMany({ where: { userId: authorized.imported.userId, importHistoryId: id } });
      await tx.importHistory.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true, deletedTransactions: deleteTransactions });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar el extracto.");
  }
}
