import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function POST() {
  try {
    await destroyCurrentSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo cerrar la sesión.");
  }
}
