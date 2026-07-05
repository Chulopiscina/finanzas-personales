import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { budgetInclude, monthStart, serializeBudget, validateBudgetBody, type BudgetBody } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

async function authorize(id: string, userId: string) {
  return prisma.monthlyBudget.findFirst({ where: { id, userId }, include: budgetInclude });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const existing = await authorize(id, session.user.id);
    if (!existing) return NextResponse.json({ error: "Presupuesto no encontrado." }, { status: 404 });
    const body = await readJson<BudgetBody>(request);
    const { data, categoryRows } = await validateBudgetBody(body, session.user.id);
    const duplicate = await prisma.monthlyBudget.findFirst({ where: { userId: session.user.id, accountId: data.accountId, month: data.month, id: { not: id } } });
    if (duplicate) return NextResponse.json({ error: "Ya existe otro presupuesto para ese mes y cuenta." }, { status: 400 });

    const budget = await prisma.$transaction(async (tx) => {
      await tx.monthlyBudgetCategory.deleteMany({ where: { budgetId: id } });
      await tx.monthlyBudgetCategory.createMany({ data: categoryRows.map((row) => ({ ...row, budgetId: id })) });
      return tx.monthlyBudget.update({ where: { id }, data, include: budgetInclude });
    });
    return NextResponse.json({ budget: serializeBudget(budget) });
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el presupuesto.");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const existing = await authorize(id, session.user.id);
    if (!existing) return NextResponse.json({ error: "Presupuesto no encontrado." }, { status: 404 });
    const body = await readJson<{ month?: string }>(request);
    const nextMonth = monthStart(body.month ?? new Date(Date.UTC(existing.month.getUTCFullYear(), existing.month.getUTCMonth() + 1, 1)));
    const duplicate = await prisma.monthlyBudget.findFirst({ where: { userId: session.user.id, accountId: existing.accountId, month: nextMonth } });
    if (duplicate) return NextResponse.json({ error: "Ya existe un presupuesto para ese mes y cuenta." }, { status: 400 });

    const budget = await prisma.monthlyBudget.create({
      data: {
        userId: session.user.id,
        accountId: existing.accountId,
        month: nextMonth,
        expectedIncome: existing.expectedIncome,
        fixedLimit: existing.fixedLimit,
        variableLimit: existing.variableLimit,
        extraLimit: existing.extraLimit,
        savingsGoal: existing.savingsGoal,
        categories: { createMany: { data: existing.categories.map((item) => ({ categoryId: item.categoryId, block: item.block })) } }
      },
      include: budgetInclude
    });
    return NextResponse.json({ budget: serializeBudget(budget) });
  } catch (error) {
    return jsonError(error, "No se pudo duplicar el presupuesto.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    const existing = await authorize(id, session.user.id);
    if (!existing) return NextResponse.json({ error: "Presupuesto no encontrado." }, { status: 404 });
    await prisma.monthlyBudget.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar el presupuesto.");
  }
}
