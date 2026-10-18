import { ImportStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lockImportAccount } from "@/lib/import-service";
import { InputError } from "@/lib/input-error";

async function authorizeImport(id: string) {
  const session = await requireUser();
  const imported = await prisma.importHistory.findUnique({ where: { id } });
  if (!imported) {
    return { error: NextResponse.json({ error: "Extracto no encontrado." }, { status: 404 }) };
  }
  if (imported.userId !== session.user.id && session.user.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: "No puedes cancelar este extracto." }, { status: 403 }) };
  }
  return { imported };
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authorized = await authorizeImport(id);
    if (authorized.error) {
      return authorized.error;
    }

    const imported = authorized.imported;
    if (imported.status !== ImportStatus.PENDING) {
      return NextResponse.json({ error: "Este extracto no esta pendiente de confirmacion." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await lockImportAccount(tx, imported.userId, imported.accountId);
      const current = await tx.importHistory.findUniqueOrThrow({ where: { id } });
      if (current.status !== ImportStatus.PENDING) throw new InputError("Este extracto ya no está pendiente.");
      await tx.importHistory.update({
      where: { id },
      data: {
        status: ImportStatus.FAILED,
        canceledAt: new Date(),
        errorMessage: "Importacion cancelada por el usuario.",
        validationMessages: ["Importacion cancelada por el usuario."]
      }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo cancelar la importacion.");
  }
}
