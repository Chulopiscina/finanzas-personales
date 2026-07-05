import { BudgetBlockType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BudgetBody = {
  month?: string;
  accountId?: string | null;
  expectedIncome?: number;
  fixedLimit?: number;
  variableLimit?: number;
  extraLimit?: number;
  savingsGoal?: number;
  categories?: Partial<Record<BudgetBlockType, string[]>>;
};

export const budgetBlocks = new Set(Object.values(BudgetBlockType));

export function monthStart(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("El mes del presupuesto no es válido.");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function amount(value: unknown, label: string) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} debe ser un importe positivo.`);
  return number;
}

export async function validateBudgetBody(body: BudgetBody, userId: string) {
  const month = body.month ? monthStart(body.month) : null;
  if (!month) throw new Error("El mes del presupuesto es obligatorio.");

  if (body.accountId) {
    const account = await prisma.account.findFirst({ where: { id: body.accountId, userId } });
    if (!account) throw new Error("La cuenta seleccionada no es válida.");
  }

  const categoryIds = [...new Set(Object.values(body.categories ?? {}).flat().filter(Boolean))];
  if (categoryIds.length > 0) {
    const categories = await prisma.category.findMany({ where: { id: { in: categoryIds }, OR: [{ userId: null }, { userId }], isArchived: false }, select: { id: true } });
    if (categories.length !== categoryIds.length) throw new Error("Alguna categoría seleccionada no es válida.");
  }

  return {
    data: {
      month,
      accountId: body.accountId || null,
      expectedIncome: amount(body.expectedIncome, "Ingresos previstos"),
      fixedLimit: amount(body.fixedLimit, "Gastos fijos"),
      variableLimit: amount(body.variableLimit, "Gastos variables"),
      extraLimit: amount(body.extraLimit, "Gastos extras"),
      savingsGoal: amount(body.savingsGoal, "Objetivo de ahorro")
    },
    categoryRows: Object.entries(body.categories ?? {}).flatMap(([block, ids]) => {
      if (!budgetBlocks.has(block as BudgetBlockType)) return [];
      return [...new Set(ids ?? [])].filter(Boolean).map((categoryId) => ({ categoryId, block: block as BudgetBlockType }));
    })
  };
}

export const budgetInclude = {
  account: { select: { id: true, name: true } },
  categories: { include: { category: { select: { id: true, name: true, color: true, type: true } } } }
};

export function serializeBudget(budget: any) {
  return {
    id: budget.id,
    month: budget.month.toISOString(),
    accountId: budget.accountId ?? "",
    accountName: budget.account?.name ?? null,
    expectedIncome: Number(budget.expectedIncome),
    fixedLimit: Number(budget.fixedLimit),
    variableLimit: Number(budget.variableLimit),
    extraLimit: Number(budget.extraLimit),
    savingsGoal: Number(budget.savingsGoal),
    categories: budget.categories.map((item: any) => ({ block: item.block, categoryId: item.categoryId, category: item.category }))
  };
}
