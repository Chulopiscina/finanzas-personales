import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { CategoryType, ImportStatus, TransactionType } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { parseBankCsv } from "@/lib/csv";
import { requireUser } from "@/lib/auth";
import { ensureDefaultAccount, recalculateMonthlySummaries } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const categoryStyle: Record<string, { color: string; icon: string; type: CategoryType }> = {
  ["Alimentaci\u00f3n"]: { color: "#22c55e", icon: "utensils", type: CategoryType.EXPENSE },
  Restaurantes: { color: "#f97316", icon: "chef-hat", type: CategoryType.EXPENSE },
  Supermercado: { color: "#84cc16", icon: "shopping-basket", type: CategoryType.EXPENSE },
  Transporte: { color: "#06b6d4", icon: "bus", type: CategoryType.EXPENSE },
  Gasolina: { color: "#eab308", icon: "fuel", type: CategoryType.EXPENSE },
  Salud: { color: "#ef4444", icon: "heart-pulse", type: CategoryType.EXPENSE },
  Compras: { color: "#a855f7", icon: "shopping-bag", type: CategoryType.EXPENSE },
  Suscripciones: { color: "#8b5cf6", icon: "repeat", type: CategoryType.EXPENSE },
  Vivienda: { color: "#14b8a6", icon: "home", type: CategoryType.EXPENSE },
  Ocio: { color: "#f43f5e", icon: "party-popper", type: CategoryType.EXPENSE },
  Viajes: { color: "#0ea5e9", icon: "plane", type: CategoryType.EXPENSE },
  ["N\u00f3mina"]: { color: "#10b981", icon: "wallet", type: CategoryType.INCOME },
  Transferencias: { color: "#64748b", icon: "arrow-left-right", type: CategoryType.TRANSFER },
  Otros: { color: "#94a3b8", icon: "circle-dot", type: CategoryType.OTHER }
};

async function resolveImportAccount(userId: string, requestedAccountId: FormDataEntryValue | null) {
  const accounts = await prisma.account.findMany({ where: { userId, isArchived: false }, orderBy: { createdAt: "asc" } });
  if (accounts.length === 0) {
    return ensureDefaultAccount(userId);
  }

  const requested = typeof requestedAccountId === "string" ? requestedAccountId : "";
  if (requested) {
    const account = accounts.find((item) => item.id === requested);
    if (!account) {
      throw new Error("La cuenta seleccionada no existe o est\u00e1 archivada.");
    }
    return account;
  }

  if (accounts.length === 1) {
    return accounts[0];
  }

  throw new Error("Selecciona la cuenta a la que pertenece este extracto.");
}

async function getOrCreateCategory(name: string) {
  const existing = await prisma.category.findFirst({ where: { userId: null, name } });
  if (existing) {
    return existing;
  }

  const style = categoryStyle[name] ?? categoryStyle.Otros;
  return prisma.category.create({
    data: {
      name,
      color: style.color,
      icon: style.icon,
      type: style.type
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    const account = await resolveImportAccount(session.user.id, formData.get("accountId"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes subir un archivo CSV o PDF." }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv") || file.type === "text/csv";
    const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";

    if (!isCsv && !isPdf) {
      return NextResponse.json({ error: "El archivo debe ser CSV o PDF." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede superar los 10 MB." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");
    const text = isCsv ? fileBuffer.toString("utf8") : null;
    const storedContent = isCsv ? text ?? "" : fileBuffer.toString("base64");
    const movements = isCsv
      ? parseBankCsv(text ?? "")
      : await import("@/lib/pdf").then(({ parseBankPdf }) => parseBankPdf(fileBuffer));

    if (movements.length === 0) {
      return NextResponse.json({ error: "El archivo no contiene movimientos." }, { status: 400 });
    }

    const categoryNames = [...new Set(movements.map((movement) => movement.categoryName))];
    const categories = await Promise.all(categoryNames.map((name) => getOrCreateCategory(name)));
    const categoryByName = new Map(categories.map((category) => [category.name, category.id]));
    const incomeTotal = movements
      .filter((movement) => movement.type === TransactionType.INCOME)
      .reduce((sum, movement) => sum + Math.abs(movement.amount), 0);
    const expenseTotal = movements
      .filter((movement) => movement.type === TransactionType.EXPENSE)
      .reduce((sum, movement) => sum + Math.abs(movement.amount), 0);

    const history = await prisma.importHistory.create({
      data: {
        userId: session.user.id,
        accountId: account.id,
        fileName: file.name,
        fileHash,
        fileSize: file.size,
        mimeType: file.type || (isPdf ? "application/pdf" : "text/csv"),
        fileContent: storedContent,
        rowCount: movements.length,
        insertedRows: 0,
        duplicateRows: 0,
        incomeTotal,
        expenseTotal,
        status: ImportStatus.COMPLETED
      }
    });

    const created = await prisma.transaction.createMany({
      data: movements.map((movement) => ({
        userId: session.user.id,
        accountId: account.id,
        categoryId: categoryByName.get(movement.categoryName),
        importHistoryId: history.id,
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
      where: { id: history.id },
      data: {
        insertedRows: created.count,
        duplicateRows: movements.length - created.count
      }
    });

    await recalculateMonthlySummaries(session.user.id);

    return NextResponse.json({
      import: {
        id: result.id,
        fileName: result.fileName,
        rowCount: result.rowCount,
        insertedRows: result.insertedRows,
        duplicateRows: result.duplicateRows,
        accountName: account.name,
        createdAt: result.createdAt.toISOString()
      }
    });
  } catch (error) {
    return jsonError(error, "No se pudo importar el archivo.");
  }
}