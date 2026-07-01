import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUserId, requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { getDashboardData } from "@/lib/finance";

export async function GET(request: NextRequest) {
  try {
    const session = await requireUser();
    const userId = getAuthorizedUserId(session.user, request.nextUrl.searchParams.get("userId"));
    const data = await getDashboardData(userId);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error, "No se pudo cargar el dashboard.");
  }
}
