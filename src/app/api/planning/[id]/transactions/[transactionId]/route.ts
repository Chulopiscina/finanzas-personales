import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; transactionId: string }> }) {
  try {
    const session = await requireUser();
    const { id, transactionId } = await params;
    const goal = await prisma.planningGoal.findUnique({ where: { id }, select: { userId: true } });
    if (!goal || goal.userId !== session.user.id) {
      return NextResponse.json({ error: "Objetivo no encontrado." }, { status: 404 });
    }

    await prisma.planningGoalTransaction.deleteMany({ where: { goalId: id, transactionId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo quitar el movimiento del objetivo.");
  }
}