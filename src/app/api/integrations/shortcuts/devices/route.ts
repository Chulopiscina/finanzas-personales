import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { InputError } from "@/lib/input-error";
import { createShortcutDevice, requireShortcuts } from "@/lib/shortcuts";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(); requireShortcuts();
    const input = await readJson<{ accountId?: string; name?: string }>(request);
    if (typeof input.accountId !== "string" || typeof input.name !== "string") throw new InputError("Nombre y cuenta obligatorios.");
    return NextResponse.json(await createShortcutDevice(user.id, input.accountId, input.name), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}
export async function DELETE(request: Request) {
  try {
    // Owners can revoke credentials even when receipt is paused.
    const { user } = await requireUser();
    const input = await readJson<{ id?: string }>(request);
    if (typeof input.id !== "string") throw new InputError("Dispositivo obligatorio.");
    const result = await prisma.shortcutDevice.updateMany({ where: { id: input.id, userId: user.id }, data: { revokedAt: new Date() } });
    if (!result.count) throw new InputError("Dispositivo no encontrado.", 404);
    return NextResponse.json({ ok: true, revokedId: input.id });
  } catch (error) { return jsonError(error); }
}
