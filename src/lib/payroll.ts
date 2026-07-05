import { CategoryType, TransactionType, type Category } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PAYROLL_CATEGORY_NAME = "N\u00f3mina";
export const PAYROLL_CATEGORY_STYLE = {
  color: "#10b981",
  icon: "wallet",
  type: CategoryType.INCOME
};

export function normalizePayrollText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isPayrollText(value: string) {
  const normalized = normalizePayrollText(value);
  return /\b(nomina|nominas|nomines)\b/.test(normalized) ||
    /\b(abono de nomina|transferencia nomina)\b/.test(normalized);
}

export function isPayrollCategoryName(value: string | null | undefined) {
  const normalized = normalizePayrollText(value ?? "");
  return normalized === "nomina" || normalized === "nominas" || normalized === "nomines";
}

export function isPayrollCategory(category: Pick<Category, "name" | "type"> | null | undefined) {
  return Boolean(category && isPayrollCategoryName(category.name));
}

export function payrollClassification() {
  return { categoryName: PAYROLL_CATEGORY_NAME, type: TransactionType.INCOME };
}

export async function ensurePayrollCategory() {
  const existing = await prisma.category.findFirst({
    where: { userId: null, name: PAYROLL_CATEGORY_NAME }
  });

  if (existing) {
    if (existing.type !== CategoryType.INCOME || existing.isArchived) {
      return prisma.category.update({
        where: { id: existing.id },
        data: { type: CategoryType.INCOME, isArchived: false, color: existing.color || PAYROLL_CATEGORY_STYLE.color, icon: existing.icon || PAYROLL_CATEGORY_STYLE.icon }
      });
    }
    return existing;
  }

  return prisma.category.create({
    data: {
      userId: null,
      name: PAYROLL_CATEGORY_NAME,
      color: PAYROLL_CATEGORY_STYLE.color,
      icon: PAYROLL_CATEGORY_STYLE.icon,
      type: PAYROLL_CATEGORY_STYLE.type
    }
  });
}