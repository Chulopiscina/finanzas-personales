import { CategoryType, type Prisma } from "@prisma/client";
import { isPayrollCategoryName, PAYROLL_CATEGORY_NAME } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";

export const categoryStyle: Record<string, { color: string; icon: string; type: CategoryType }> = {
  ["Alimentaci\u00f3n"]: { color: "#22c55e", icon: "utensils", type: CategoryType.EXPENSE },
  Restaurantes: { color: "#f97316", icon: "chef-hat", type: CategoryType.EXPENSE },
  Supermercado: { color: "#84cc16", icon: "shopping-basket", type: CategoryType.EXPENSE },
  Transporte: { color: "#06b6d4", icon: "bus", type: CategoryType.EXPENSE },
  Gasolina: { color: "#eab308", icon: "fuel", type: CategoryType.EXPENSE },
  Salud: { color: "#ef4444", icon: "heart-pulse", type: CategoryType.EXPENSE },
  Compras: { color: "#a855f7", icon: "shopping-bag", type: CategoryType.EXPENSE },
  Suscripciones: { color: "#8b5cf6", icon: "repeat", type: CategoryType.EXPENSE },
  Vivienda: { color: "#14b8a6", icon: "home", type: CategoryType.EXPENSE },
  Ocio: { color: "#f43f5e", icon: "party-popper", type: CategoryType.EXPENSE },
  Viajes: { color: "#0ea5e9", icon: "plane", type: CategoryType.EXPENSE },
  ["N\u00f3mina"]: { color: "#10b981", icon: "wallet", type: CategoryType.INCOME },
  Transferencias: { color: "#64748b", icon: "arrow-left-right", type: CategoryType.TRANSFER },
  Otros: { color: "#94a3b8", icon: "circle-dot", type: CategoryType.OTHER }
};

export function canonicalCategoryName(name: string) {
  return isPayrollCategoryName(name) ? PAYROLL_CATEGORY_NAME : name;
}

export async function getOrCreateImportCategory(name: string, userId?: string, db: Prisma.TransactionClient = prisma) {
  const canonicalName = canonicalCategoryName(name);
  const own = userId ? await db.category.findFirst({ where: { userId, name: canonicalName, isArchived: false } }) : null;
  if (own) return own;
  const existing = await db.category.findFirst({ where: { userId: null, name: canonicalName }, orderBy: { createdAt: "asc" } });
  if (existing) {
    return existing;
  }

  const style = categoryStyle[canonicalName] ?? categoryStyle.Otros;
  if (userId) return db.category.upsert({ where: { userId_name: { userId, name: canonicalName } }, create: { userId, name: canonicalName, color: style.color, icon: style.icon, type: style.type }, update: {} });
  return db.category.create({
    data: {
      name: canonicalName,
      color: style.color,
      icon: style.icon,
      type: style.type
    }
  });
}
