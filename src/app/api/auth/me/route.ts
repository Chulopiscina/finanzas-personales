import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireUser();
    return NextResponse.json(session);
  } catch (error) {
    return jsonError(error, "No se pudo recuperar la sesión.");
  }
}
