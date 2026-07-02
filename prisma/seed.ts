import { AccountType, CategoryType, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const defaultCategories = [
  ["Alimentación", "#22c55e", "utensils", CategoryType.EXPENSE],
  ["Restaurantes", "#f97316", "chef-hat", CategoryType.EXPENSE],
  ["Supermercado", "#84cc16", "shopping-basket", CategoryType.EXPENSE],
  ["Transporte", "#06b6d4", "bus", CategoryType.EXPENSE],
  ["Gasolina", "#eab308", "fuel", CategoryType.EXPENSE],
  ["Salud", "#ef4444", "heart-pulse", CategoryType.EXPENSE],
  ["Compras", "#a855f7", "shopping-bag", CategoryType.EXPENSE],
  ["Suscripciones", "#8b5cf6", "repeat", CategoryType.EXPENSE],
  ["Vivienda", "#14b8a6", "home", CategoryType.EXPENSE],
  ["Ocio", "#f43f5e", "party-popper", CategoryType.EXPENSE],
  ["Viajes", "#0ea5e9", "plane", CategoryType.EXPENSE],
  ["Nómina", "#10b981", "wallet", CategoryType.INCOME],
  ["Transferencias", "#64748b", "arrow-left-right", CategoryType.TRANSFER],
  ["Otros", "#94a3b8", "circle-dot", CategoryType.OTHER]
] as const;

async function upsertGlobalCategory(name: string, color: string, icon: string, type: CategoryType) {
  const existing = await prisma.category.findFirst({ where: { userId: null, name } });
  if (existing) {
    await prisma.category.update({ where: { id: existing.id }, data: { color, icon, type, isArchived: false } });
    return;
  }

  await prisma.category.create({ data: { userId: null, name, color, icon, type } });
}

async function main() {
  for (const [name, color, icon, type] of defaultCategories) {
    await upsertGlobalCategory(name, color, icon, type);
  }

  const email = process.env.INITIAL_ADMIN_EMAIL ?? "oriolcasaponsaprat@gmail.com";
  const password = process.env.INITIAL_ADMIN_PASSWORD ?? "Pelota.1";
  const name = process.env.INITIAL_ADMIN_NAME ?? "Oriol Casa Ponsa Prat";
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      name,
      email,
      passwordHash,
      role: Role.ADMIN
    },
    update: { name, role: Role.ADMIN }
  });

  await prisma.account.upsert({
    where: { userId_name: { userId: admin.id, name: "Cuenta principal" } },
    create: {
      userId: admin.id,
      name: "Cuenta principal",
      type: AccountType.BANK,
      color: "#14b8a6",
      icon: "landmark"
    },
    update: {}
  });

  console.log(`Seed completado. Admin inicial: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });