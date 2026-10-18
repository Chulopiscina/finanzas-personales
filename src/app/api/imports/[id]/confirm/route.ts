import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/api";
import { confirmStatement } from "@/lib/import-service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = await readJson<{ force?: boolean }>(request);
    const result = await confirmStatement(id, user, body.force === true);
    return NextResponse.json({ import: { id: result.id, fileName: result.fileName, rowCount: result.rowCount, insertedRows: result.insertedRows, duplicateRows: result.duplicateRows, accountName: result.accountName, createdAt: result.createdAt.toISOString() } });
  } catch (error) { return jsonError(error, "No se pudo confirmar la importación."); }
}
