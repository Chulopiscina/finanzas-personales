import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ImportStatus } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { parseBBVACsv } from "@/lib/csv";
import { requireUser } from "@/lib/auth";
import { recalculateMonthlySummaries } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

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
      ? parseBBVACsv(text ?? "")
      : await import("@/lib/pdf").then(({ parseBBVAPdf }) => parseBBVAPdf(fileBuffer));

    if (movements.length === 0) {
      return NextResponse.json({ error: "El archivo no contiene movimientos." }, { status: 400 });
    }

    const categoryNames = [...new Set(movements.map((movement) => movement.categoryName))];
    const categories = await Promise.all(
      categoryNames.map((name) =>
        prisma.category.upsert({
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

    const history = await prisma.importHistory.create({
      data: {
        userId: session.user.id,
        fileName: file.name,
        fileHash,
        fileSize: file.size,
        mimeType: file.type || (isPdf ? "application/pdf" : "text/csv"),
        fileContent: storedContent,
        rowCount: movements.length,
        insertedRows: 0,
        duplicateRows: 0,
        status: ImportStatus.COMPLETED
      }
    });

    const created = await prisma.transaction.createMany({
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
        createdAt: result.createdAt.toISOString()
      }
    });
  } catch (error) {
    return jsonError(error, "No se pudo importar el archivo.");
  }
}
