import { ImportStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { detectAndMarkInternalTransfers, recalculateMonthlySummaries } from "@/lib/finance";
import { canonicalCategoryName, getOrCreateImportCategory } from "@/lib/import-categories";
import { deserializePreviewMovement, type ImportPreviewData } from "@/lib/import-preview";
import { prisma } from "@/lib/prisma";

type ConfirmBody = {
  force?: boolean;
};

async function authorizeImport(id: string) {
  const session = await requireUser();
  const imported = await prisma.importHistory.findUnique({ where: { id }, include: { account: true } });
  if (!imported) {
    return { error: NextResponse.json({ error: "Extracto no encontrado." }, { status: 404 }) };
  }
  if (imported.userId !== session.user.id && session.user.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: "No puedes confirmar este extracto." }, { status: 403 }) };
  }
  return { session, imported };
}

function getPreviewData(value: unknown): ImportPreviewData | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const preview = value as ImportPreviewData;
  return Array.isArray(preview.movements) ? preview : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authorized = await authorizeImport(id);
    if (authorized.error) {
      return authorized.error;
    }

    const body = await readJson<ConfirmBody>(request).catch(() => ({ force: false }));
    const { imported } = authorized;
    if (imported.status !== ImportStatus.PENDING) {
      return NextResponse.json({ error: "Este extracto no esta pendiente de confirmacion." }, { status: 400 });
    }

    const preview = getPreviewData(imported.previewData);
    if (!preview) {
      return NextResponse.json({ error: "No se encontro la vista previa de este extracto." }, { status: 400 });
    }
    if (preview.validationStatus === "error") {
      return NextResponse.json({ error: "Este extracto tiene errores y no se puede importar." }, { status: 400 });
    }
    if (preview.confidence === "baja" && !body.force) {
      return NextResponse.json({ error: "La confianza del analisis es baja. Confirma explicitamente que quieres importar este extracto." }, { status: 409 });
    }

    const movements = preview.movements.map(deserializePreviewMovement);
    const categoryNames = [...new Set(movements.map((movement) => canonicalCategoryName(movement.categoryName)))];
    const categories = await Promise.all(categoryNames.map((name) => getOrCreateImportCategory(name)));
    const categoryByName = new Map(categories.map((category) => [category.name, category.id]));

    const created = await prisma.transaction.createMany({
      data: movements.map((movement) => ({
        userId: imported.userId,
        accountId: imported.accountId,
        categoryId: categoryByName.get(canonicalCategoryName(movement.categoryName)),
        importHistoryId: imported.id,
        date: movement.date,
        concept: movement.concept,
        rawDescription: movement.concept,
        amount: movement.amount,
        balance: movement.balance,
        type: movement.type,
        sourceHash: movement.sourceHash,
        raw: movement.raw
      })),
      skipDuplicates: true
    });

    const result = await prisma.importHistory.update({
      where: { id: imported.id },
      data: {
        status: ImportStatus.COMPLETED,
        rowCount: movements.length,
        insertedRows: created.count,
        duplicateRows: movements.length - created.count,
        incomeTotal: preview.incomeTotal,
        expenseTotal: preview.expenseTotal,
        confirmedAt: new Date(),
        errorMessage: null
      }
    });

    await detectAndMarkInternalTransfers(imported.userId);
    await recalculateMonthlySummaries(imported.userId);

    return NextResponse.json({
      import: {
        id: result.id,
        fileName: result.fileName,
        rowCount: result.rowCount,
        insertedRows: result.insertedRows,
        duplicateRows: result.duplicateRows,
        accountName: imported.account.name,
        createdAt: result.createdAt.toISOString()
      }
    });
  } catch (error) {
    return jsonError(error, "No se pudo confirmar la importacion.");
  }
}