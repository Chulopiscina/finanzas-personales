import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { recalculateMonthlySummaries } from "@/lib/finance";
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
    if (body.deleteTransactions) {
      await prisma.transaction.deleteMany({ where: { importHistoryId: id } });
      await prisma.importHistory.delete({ where: { id } });
      await recalculateMonthlySummaries(authorized.imported.userId);
      return NextResponse.json({ ok: true, deletedTransactions: true });
    }

    await prisma.transaction.updateMany({ where: { importHistoryId: id }, data: { importHistoryId: null } });
    await prisma.importHistory.delete({ where: { id } });
    await recalculateMonthlySummaries(authorized.imported.userId);
    return NextResponse.json({ ok: true, deletedTransactions: false });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar el extracto.");
  }
}