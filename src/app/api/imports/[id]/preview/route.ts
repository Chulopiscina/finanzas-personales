import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { ImportPreviewData } from "@/lib/import-preview";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser(); const { id } = await params;
    const row = await prisma.importHistory.findFirst({ where: { id, ...(user.role === "ADMIN" ? {} : { userId: user.id }) }, select: { id: true, status: true, previewData: true, account: { select: { name: true } } } });
    if (!row) return NextResponse.json({ error: "Extracto no encontrado." }, { status: 404 });
    if (row.status !== "PENDING" || !row.previewData) return NextResponse.json({ error: "Este extracto ya no tiene una revisión pendiente." }, { status: 409 });
    const data = row.previewData as unknown as ImportPreviewData;
    const requested = Number(request.nextUrl.searchParams.get("page") ?? 1);
    const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, Math.max(1, Math.ceil(data.rowCount / 100))) : 1;
    return NextResponse.json({ preview: { ...data, id, accountName: row.account.name, movements: data.movements.slice((page - 1) * 100, page * 100).map(({ raw: _raw, ...movement }) => movement) }, page });
  } catch (error) { return jsonError(error, "No se pudo recuperar la vista previa."); }
}
