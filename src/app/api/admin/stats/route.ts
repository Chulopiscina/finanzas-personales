import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { getAdminStats } from "@/lib/finance";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getAdminStats());
  } catch (error) {
    return jsonError(error, "No se pudieron cargar estadísticas globales.");
  }
}
