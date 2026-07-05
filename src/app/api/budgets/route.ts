import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { budgetInclude, serializeBudget, validateBudgetBody, type BudgetBody } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireUser();
    const budgets = await prisma.monthlyBudget.findMany({
      where: { userId: session.user.id },
      include: budgetInclude,
      orderBy: [{ month: "desc" }, { createdAt: "desc" }]
    });
    return NextResponse.json({ budgets: budgets.map(serializeBudget) });
  } catch (error) {
    return jsonError(error, "No se pudieron cargar los presupuestos.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const body = await readJson<BudgetBody>(request);
    const { data, categoryRows } = await validateBudgetBody(body, session.user.id);
    const existing = await prisma.monthlyBudget.findFirst({ where: { userId: session.user.id, accountId: data.accountId, month: data.month } });
    if (existing) return NextResponse.json({ error: "Ya existe un presupuesto para ese mes y cuenta." }, { status: 400 });

    const budget = await prisma.monthlyBudget.create({
      data: {
        ...data,
        userId: session.user.id,
        categories: { createMany: { data: categoryRows } }
      },
      include: budgetInclude
    });
    return NextResponse.json({ budget: serializeBudget(budget) });
  } catch (error) {
    return jsonError(error, "No se pudo crear el presupuesto.");
  }
}
