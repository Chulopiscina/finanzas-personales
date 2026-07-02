import { AccountType } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AccountBody = {
  name?: string;
  type?: AccountType;
  initialBalance?: number;
  currency?: string;
  color?: string | null;
  icon?: string | null;
  isArchived?: boolean;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
    }

    const body = await readJson<AccountBody>(request);
    const updated = await prisma.account.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        type: body.type,
        initialBalance: typeof body.initialBalance === "number" ? body.initialBalance : undefined,
        currency: body.currency?.trim() || undefined,
        color: body.color === null ? null : body.color?.trim() || undefined,
        icon: body.icon === null ? null : body.icon?.trim() || undefined,
        isArchived: typeof body.isArchived === "boolean" ? body.isArchived : undefined
      }
    });
    return NextResponse.json({ account: updated });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar la cuenta.");
  }
}