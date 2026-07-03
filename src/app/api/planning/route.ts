import { NextResponse } from "next/server";
import { PlanningGoalType, PlanningPeriod, PlanningStatus } from "@prisma/client";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getPlanningGoalProgress } from "@/lib/planning";
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

export async function GET() {
  try {
    const session = await requireUser();
    const goals = await getPlanningGoalProgress(session.user.id);
    return NextResponse.json({ goals });
  } catch (error) {
    return jsonError(error, "No se pudieron cargar los objetivos.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const body = await readJson<PlanningBody>(request);
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "El nombre del objetivo es obligatorio." }, { status: 400 });
    }

    if (typeof body.targetAmount !== "number" || body.targetAmount <= 0) {
      return NextResponse.json({ error: "El importe objetivo debe ser mayor que cero." }, { status: 400 });
    }

    const categoryIds = [...new Set(body.categoryIds ?? [])];
    await validateRelations(session.user.id, body.accountId, categoryIds);

    const goal = await prisma.planningGoal.create({
      data: {
        userId: session.user.id,
        name,
        type: body.type ?? PlanningGoalType.VARIABLE_EXPENSE,
        targetAmount: body.targetAmount,
        period: body.period ?? PlanningPeriod.MONTHLY,
        periodStart: body.periodStart ? new Date(body.periodStart) : null,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : null,
        accountId: body.accountId || null,
        color: body.color?.trim() || "#14b8a6",
        icon: body.icon?.trim() || "target",
        status: body.status ?? PlanningStatus.ACTIVE,
        showInDashboard: Boolean(body.showInDashboard),
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) }
      },
      include: { account: true, categories: { include: { category: true } } }
    });

    return NextResponse.json({ goal });
  } catch (error) {
    return jsonError(error, "No se pudo crear el objetivo.");
  }
}
