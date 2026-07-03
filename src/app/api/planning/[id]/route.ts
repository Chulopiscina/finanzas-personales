import { NextResponse } from "next/server";
import { PlanningGoalType, PlanningPeriod, PlanningStatus } from "@prisma/client";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PlanningBody = {
  name?: string;
  type?: PlanningGoalType;
  targetAmount?: number;
  period?: PlanningPeriod;
  periodStart?: string | null;
  periodEnd?: string | null;
  accountId?: string | null;
  categoryIds?: string[];
  color?: string | null;
  icon?: string | null;
  status?: PlanningStatus;
  showInDashboard?: boolean;
};

async function getOwnedGoal(id: string, userId: string) {
  const goal = await prisma.planningGoal.findUnique({ where: { id }, include: { categories: true } });
  if (!goal || goal.userId !== userId) return null;
  return goal;
}

async function validateRelations(userId: string, accountId?: string | null, categoryIds: string[] = []) {
  if (accountId) {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== userId || account.isArchived) {
      throw new Error("La cuenta seleccionada no es válida.");
    }
  }

  if (categoryIds.length > 0) {
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds }, OR: [{ userId: null }, { userId }], isArchived: false },
      select: { id: true }
    });
    if (categories.length !== new Set(categoryIds).size) {
      throw new Error("Alguna categoría seleccionada no es válida.");
    }
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const existing = await getOwnedGoal(id, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Objetivo no encontrado." }, { status: 404 });
    }

    const body = await readJson<PlanningBody>(request);
    const categoryIds = body.categoryIds ? [...new Set(body.categoryIds)] : null;
    await validateRelations(session.user.id, body.accountId, categoryIds ?? undefined);

    const updated = await prisma.$transaction(async (tx) => {
      if (categoryIds) {
        await tx.planningGoalCategory.deleteMany({ where: { goalId: id } });
        if (categoryIds.length > 0) {
          await tx.planningGoalCategory.createMany({ data: categoryIds.map((categoryId) => ({ goalId: id, categoryId })) });
        }
      }

      return tx.planningGoal.update({
        where: { id },
        data: {
          name: body.name?.trim() || undefined,
          type: body.type,
          targetAmount: typeof body.targetAmount === "number" && body.targetAmount > 0 ? body.targetAmount : undefined,
          period: body.period,
          periodStart: body.periodStart === null ? null : body.periodStart ? new Date(body.periodStart) : undefined,
          periodEnd: body.periodEnd === null ? null : body.periodEnd ? new Date(body.periodEnd) : undefined,
          accountId: body.accountId === null ? null : body.accountId || undefined,
          color: body.color === null ? null : body.color?.trim() || undefined,
          icon: body.icon === null ? null : body.icon?.trim() || undefined,
          status: body.status,
          showInDashboard: typeof body.showInDashboard === "boolean" ? body.showInDashboard : undefined
        },
        include: { account: true, categories: { include: { category: true } } }
      });
    });

    return NextResponse.json({ goal: updated });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el objetivo.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const existing = await getOwnedGoal(id, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Objetivo no encontrado." }, { status: 404 });
    }

    await prisma.planningGoal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar el objetivo.");
  }
}
