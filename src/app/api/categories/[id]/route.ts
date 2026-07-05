import { CategoryType } from "@prisma/client";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { isPayrollCategoryName } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";

type CategoryBody = {
  name?: string;
  type?: CategoryType;
  color?: string;
  icon?: string;
  isArchived?: boolean;
};

async function getOwnedCategory(id: string, userId: string) {
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { transactions: true } } } });
  if (!category || category.userId !== userId) {
    return null;
  }
  return category;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const category = await getOwnedCategory(id, session.user.id);
    if (!category) {
      return NextResponse.json({ error: "Solo puedes editar categorías creadas por ti." }, { status: 404 });
    }

    const body = await readJson<CategoryBody>(request);
    if (body.name && isPayrollCategoryName(body.name)) {
      return NextResponse.json({ error: "La categoría Nómina ya existe como categoría base. Usa esa categoría para evitar duplicados." }, { status: 400 });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        type: body.type,
        color: body.color?.trim() || undefined,
        icon: body.icon?.trim() || undefined,
        isArchived: typeof body.isArchived === "boolean" ? body.isArchived : undefined
      }
    });
    return NextResponse.json({ category: updated });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar la categoría.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const category = await getOwnedCategory(id, session.user.id);
    if (!category) {
      return NextResponse.json({ error: "Solo puedes archivar categorías creadas por ti." }, { status: 404 });
    }

    const updated = await prisma.category.update({ where: { id }, data: { isArchived: true } });
    return NextResponse.json({ category: updated });
  } catch (error) {
    return jsonError(error, "No se pudo archivar la categoría.");
  }
}