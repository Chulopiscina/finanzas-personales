import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function safeFileName(fileName: string) {
  const cleaned = fileName.replace(/["\\\r\n]/g, "_").trim();
  return cleaned || "movimientos.csv";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const importedFile = await prisma.importHistory.findUnique({
      where: { id },
      select: {
        userId: true,
        fileName: true,
        mimeType: true,
        fileContent: true
      }
    });

    if (!importedFile || !importedFile.fileContent) {
      return NextResponse.json({ error: "CSV no encontrado." }, { status: 404 });
    }

    if (importedFile.userId !== session.user.id && session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "No puedes descargar este CSV." }, { status: 403 });
    }

    return new NextResponse(importedFile.fileContent, {
      headers: {
        "Content-Type": importedFile.mimeType || "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFileName(importedFile.fileName)}"`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return jsonError(error, "No se pudo descargar el CSV.");
  }
}
