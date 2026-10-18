import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { readNotificationJson } from "@/lib/shortcuts";
import { InputError } from "@/lib/input-error";
import { startShortcutPairing, shortcutPairingStatus } from "@/lib/shortcut-pairing";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request) {
  try {
    const { user, sessionId } = await requireUser();
    const input = await readNotificationJson(request);
    if (!input || typeof input !== "object" || Array.isArray(input) || !("accountId" in input) || typeof input.accountId !== "string" || !("consent" in input) || input.consent !== true) throw new InputError("Selecciona una cuenta y autoriza el envío de las notificaciones BBVA.");
    // Origin is checked against Host by middleware; Next's internal URL can use localhost.
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    return NextResponse.json(await startShortcutPairing(user.id, input.accountId, origin, sessionId), { headers });
  } catch (error) { return jsonError(error); }
}
export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id || id.length > 100) throw new InputError("Conexión obligatoria.");
    return NextResponse.json(await shortcutPairingStatus(user.id, id), { headers });
  } catch (error) { return jsonError(error); }
}
