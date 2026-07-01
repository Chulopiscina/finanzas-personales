import { NextRequest, NextResponse } from "next/server";
import { ImportStatus } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { csvFileHash, parseBBVACsv } from "@/lib/csv";
import { requireUser } from "@/lib/auth";
import { recalculateMonthlySummaries } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const categoryStyle: Record<string, { color: string; icon: string }> = {
  Alimentación: { color: "#22c55e", icon: "utensils" },
  Restaurantes: { color: "#f97316", icon: "chef-hat" },
  Supermercado: { color: "#84cc16", icon: "shopping-basket" },
  Transporte: { color: "#06b6d4", icon: "bus" },
  Gasolina: { color: "#eab308", icon: "fuel" },
  Salud: { color: "#ef4444", icon: "heart-pulse" },
  Compras: { color: "#a855f7", icon: "shopping-bag" },
  Suscripciones: { color: "#8b5cf6", icon: "repeat" },
  Vivienda: { color: "#14b8a6", icon: "home" },
  Ocio: { color: "#f43f5e", icon: "party-popper" },
  Viajes: { color: "#0ea5e9", icon: "plane" },
  Nómina: { color: "#10b981", icon: "wallet" },
  Transferencias: { color: "#64748b", icon: "arrow-left-right" },
  Otros: { color: "#94a3b8", icon: "circle-dot" }
};

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes subir un archivo CSV." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "El archivo debe tener extensión .csv." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "El CSV no puede superar los 5 MB." }, { status: 400 });
    }

    const text = await file.text();
    const movements = parseBBVACsv(text);
    const fileHash = csvFileHash(text);

    if (movements.length === 0) {
      return NextResponse.json({ error: "El CSV no contiene movimientos." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const categoryNames = [...new Set(movements.map((movement) => movement.categoryName))];
      const categories = await Promise.all(
        categoryNames.map((name) =>
          tx.category.upsert({
            where: { name },
            create: {
              name,
              color: categoryStyle[name]?.color ?? "#94a3b8",
              icon: categoryStyle[name]?.icon ?? "circle-dot"
            },
            update: {}
          })
        )
      );
      const categoryByName = new Map(categories.map((category) => [category.name, category.id]));

      const history = await tx.importHistory.create({
        data: {
          userId: session.user.id,
          fileName: file.name,
          fileHash,
          fileSize: file.size,
          mimeType: file.type || "text/csv",
          fileContent: text,
          rowCount: movements.length,
          insertedRows: 0,
          duplicateRows: 0,
          status: ImportStatus.COMPLETED
        }
      });

      const created = await tx.transaction.createMany({
        data: movements.map((movement) => ({
          userId: session.user.id,
          categoryId: categoryByName.get(movement.categoryName),
          importHistoryId: history.id,
          date: movement.date,
          concept: movement.concept,
          amount: movement.amount,
          balance: movement.balance,
          type: movement.type,
          sourceHash: movement.sourceHash,
          raw: movement.raw
        })),
        skipDuplicates: true
      });

      const updatedHistory = await tx.importHistory.update({
        where: { id: history.id },
        data: {
          insertedRows: created.count,
          duplicateRows: movements.length - created.count
        }
      });

      return updatedHistory;
    });

    await recalculateMonthlySummaries(session.user.id);

    return NextResponse.json({
      import: {
        id: result.id,
        fileName: result.fileName,
        rowCount: result.rowCount,
        insertedRows: result.insertedRows,
        duplicateRows: result.duplicateRows,
        createdAt: result.createdAt.toISOString()
      }
    });
  } catch (error) {
    return jsonError(error, "No se pudo importar el CSV.");
  }
}
