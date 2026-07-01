import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const defaultCategories = [
  ["AlimentaciÃ³n", "#22c55e", "utensils"],
  ["Restaurantes", "#f97316", "chef-hat"],
  ["Supermercado", "#84cc16", "shopping-basket"],
  ["Transporte", "#06b6d4", "bus"],
  ["Gasolina", "#eab308", "fuel"],
  ["Salud", "#ef4444", "heart-pulse"],
  ["Compras", "#a855f7", "shopping-bag"],
  ["Suscripciones", "#8b5cf6", "repeat"],
  ["Vivienda", "#14b8a6", "home"],
  ["Ocio", "#f43f5e", "party-popper"],
  ["Viajes", "#0ea5e9", "plane"],
  ["NÃ³mina", "#10b981", "wallet"],
  ["Transferencias", "#64748b", "arrow-left-right"],
  ["Otros", "#94a3b8", "circle-dot"]
] as const;

async function main() {
  for (const [name, color, icon] of defaultCategories) {
    await prisma.category.upsert({
      where: { name },
      create: { name, color, icon },
      update: { color, icon }
    });
  }

  const email = process.env.INITIAL_ADMIN_EMAIL ?? "oriolcasaponsaprat@gmail.com";
  const password = process.env.INITIAL_ADMIN_PASSWORD ?? "Pelota.1";
  const name = process.env.INITIAL_ADMIN_NAME ?? "Oriol Casa Ponsa Prat";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    create: {
      name,
      email,
      passwordHash,
      role: Role.ADMIN
    },
    update: { name, role: Role.ADMIN }
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
