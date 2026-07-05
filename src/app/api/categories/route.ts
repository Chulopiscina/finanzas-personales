import { CategoryType } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ensurePayrollCategory, isPayrollCategoryName } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";

type CategoryBody = {
  name?: string;
  type?: CategoryType;
  color?: string;
  icon?: string;
};

export async function GET() {
  try {
    const session = await requireUser();
    const categories = await prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId: session.user.id }] },
      orderBy: [{ isArchived: "asc" }, { name: "asc" }],
      include: { _count: { select: { transactions: true } } }
    });
    return NextResponse.json({ categories });
  } catch (error) {
    return jsonError(error, "No se pudieron cargar las categorías.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const body = await readJson<CategoryBody>(request);
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "El nombre de la categoría es obligatorio." }, { status: 400 });
    }

    if (isPayrollCategoryName(name)) {
      const category = await ensurePayrollCategory();
      return NextResponse.json({ category });
    }

    const category = await prisma.category.create({
      data: {
        userId: session.user.id,
        name,
        type: body.type ?? CategoryType.OTHER,
        color: body.color?.trim() || "#94a3b8",
        icon: body.icon?.trim() || "circle-dot"
      }
    });
    return NextResponse.json({ category });
  } catch (error) {
    return jsonError(error, "No se pudo crear la categoría.");
  }
}