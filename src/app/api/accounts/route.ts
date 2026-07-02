import { AccountType } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ensureDefaultAccount } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

type AccountBody = {
  name?: string;
  type?: AccountType;
  initialBalance?: number;
  currency?: string;
  color?: string | null;
  icon?: string | null;
};

export async function GET() {
  try {
    const session = await requireUser();
    await ensureDefaultAccount(session.user.id);
    const accounts = await prisma.account.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { transactions: true, imports: true } } }
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    return jsonError(error, "No se pudieron cargar las cuentas.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const body = await readJson<AccountBody>(request);
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "El nombre de la cuenta es obligatorio." }, { status: 400 });
    }

    const account = await prisma.account.create({
      data: {
        userId: session.user.id,
        name,
        type: body.type ?? AccountType.BANK,
        initialBalance: typeof body.initialBalance === "number" ? body.initialBalance : 0,
        currency: body.currency?.trim() || "EUR",
        color: body.color?.trim() || null,
        icon: body.icon?.trim() || null
      }
    });
    return NextResponse.json({ account });
  } catch (error) {
    return jsonError(error, "No se pudo crear la cuenta.");
  }
}