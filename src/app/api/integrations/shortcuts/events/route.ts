import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { InputError } from "@/lib/input-error";
import { readNotificationJson, receiveNotification, requireShortcuts } from "@/lib/shortcuts";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireShortcuts();
    if (!request.headers.get("content-type")?.includes("application/json")) throw new InputError("Usa Content-Type: application/json.", 415);
    const event = await receiveNotification(request.headers.get("authorization"), await readNotificationJson(request));
    return NextResponse.json(event, { status: event.duplicate ? 200 : 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudo recibir la notificación."); }
}
