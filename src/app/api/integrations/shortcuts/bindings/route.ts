import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/api";
import { InputError } from "@/lib/input-error";
import { setShortcutBinding } from "@/lib/shortcut-bindings";

export async function PUT(request: Request) {
  try {
    const { user } = await requireUser();
    const input = await readJson<{ deviceId?: string; bankId?: string; accountId?: string | null }>(request);
    if (typeof input.deviceId !== "string" || typeof input.bankId !== "string" || !(input.accountId === null || typeof input.accountId === "string")) throw new InputError("Dispositivo, banco y cuenta obligatorios.");
    return NextResponse.json({ bindings: await setShortcutBinding(user.id, input.deviceId, input.bankId, input.accountId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}
