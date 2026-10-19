import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { readNotificationJson, requireShortcutSetup } from "@/lib/shortcuts";
import { exchangeShortcutPairing } from "@/lib/shortcut-pairing";
import { InputError } from "@/lib/input-error";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireShortcutSetup();
    if (!request.headers.get("content-type")?.includes("application/json")) throw new InputError("Usa JSON.", 415);
    const input = await readNotificationJson(request);
    const code = input && typeof input === "object" && "code" in input ? input.code : undefined;
    return NextResponse.json(await exchangeShortcutPairing(code), { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return jsonError(error); }
}
