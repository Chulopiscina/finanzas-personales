import { NextResponse } from "next/server";
import { PlanningStatus, Role } from "@prisma/client";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PlanningAssociationBody = {
  goals?: Array<{ id: string; includeInternalTransfer?: boolean }>;
};

async function authorizeTransaction(id: string) {
  const session = await requireUser();
  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction) {
    return { error: NextResponse.json({ error: "Movimiento no encontrado." }, { status: 404 }) };
  }
  if (transaction.userId !== session.user.id && session.user.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: "No puedes editar este movimiento." }, { status: 403 }) };
  }
  return { session, transaction };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authorized = await authorizeTransaction(id);
    if (authorized.error) return authorized.error;

    const body = await readJson<PlanningAssociationBody>(request);
    const requested = new Map((body.goals ?? []).map((goal) => [goal.id, Boolean(goal.includeInternalTransfer)]));
    const goalIds = [...requested.keys()];

    if (goalIds.length > 0) {
      const validGoals = await prisma.planningGoal.findMany({
        where: { id: { in: goalIds }, userId: authorized.transaction.userId, status: { in: [PlanningStatus.ACTIVE, PlanningStatus.PAUSED, PlanningStatus.COMPLETED] } },
        select: { id: true }
      });
      if (validGoals.length !== goalIds.length) {
        return NextResponse.json({ error: "Algún objetivo seleccionado no es válido." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.planningGoalTransaction.deleteMany({ where: { transactionId: id } });
      if (goalIds.length > 0) {
        await tx.planningGoalTransaction.createMany({
          data: goalIds.map((goalId) => ({
            goalId,
            transactionId: id,
            includeInternalTransfer: requested.get(goalId) ?? false
          }))
        });
      }
    });

    const planningGoals = await prisma.planningGoalTransaction.findMany({
      where: { transactionId: id },
      include: { goal: { select: { id: true, name: true, color: true, status: true } } },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({ planningGoals });
  } catch (error) {
    return jsonError(error, "No se pudieron actualizar los objetivos del movimiento.");
  }
}