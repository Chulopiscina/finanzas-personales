import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { verifyShortcutConnection } from "@/lib/shortcut-pairing";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try { return NextResponse.json(await verifyShortcutConnection(request.headers.get("authorization")), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return jsonError(error); }
}
