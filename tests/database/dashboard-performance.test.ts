import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";

const url = process.env.TEST_DATABASE_URL;
if (url && (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) || new URL(url).pathname !== "/finanzas_test")) throw new Error("Solo BD local desechable");
describe.skipIf(!url)("rendimiento dashboard completo", () => {
  const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  afterAll(async () => { await db.$disconnect(); const { prisma } = await import("@/lib/prisma"); await prisma.$disconnect(); });
  it("mide lecturas y bytes con 2000 movimientos y 12 objetivos", async () => {
    const user = await db.user.create({ data: { name: "Perf", email: randomUUID() + "@example.test", passwordHash: "synthetic" } });
    const account = await db.account.create({ data: { userId: user.id, name: "Banco" } });
    const category = await db.category.create({ data: { userId: user.id, name: "Compras", type: "EXPENSE", color: "#22c55e", icon: "wallet" } });
    await db.transaction.createMany({ data: Array.from({ length: 2000 }, (_, i) => ({ userId: user.id, accountId: account.id, categoryId: category.id, date: new Date("2026-06-15"), concept: "Compra ficticia", amount: -1, type: "EXPENSE", sourceHash: String(i), raw: { original: "x".repeat(500) } })) });
    for (let i = 0; i < 12; i++) await db.planningGoal.create({ data: { userId: user.id, name: "Objetivo " + i, type: "VARIABLE_EXPENSE", targetAmount: 3000, showInDashboard: true, categories: { create: { categoryId: category.id } } } });
    const { prisma } = await import("@/lib/prisma"); const { getDashboardData } = await import("@/lib/finance");
    let measuring = false, calls = 0, bytes = 0;
    prisma.$use(async (params, next) => { const value = await next(params); if (measuring) { calls++; bytes += Buffer.byteLength(JSON.stringify(value) ?? ""); } return value; });
    const samples = [];
    for (let i = 0; i < 4; i++) {
      calls = 0; bytes = 0; measuring = true; const start = performance.now();
      const data = await getDashboardData(user.id, null, "all");
      expect(data.planning).toHaveLength(12);
      expect(data.planning[0].actualAmount).toBe(2000);
      expect(data.planning[0].movements).toHaveLength(0);
      samples.push({ ms: Number((performance.now() - start).toFixed(2)), calls, bytes }); measuring = false;
      expect(data.metrics.netExpenses).toBe(2000); expect(data.metrics.currentBalance).toBe(-2000);
    }
    const result = { movements: 2000, goals: 12, median: samples.slice(1).sort((a, b) => a.ms - b.ms)[1] };
    await mkdir("outputs", { recursive: true });
    try { await access("outputs/dashboard-before.json"); } catch { await writeFile("outputs/dashboard-before.json", JSON.stringify(result, null, 2)); }
    await writeFile("outputs/dashboard-after.json", JSON.stringify(result, null, 2));
    console.info("Dashboard local, operaciones Prisma y bytes devueltos al servidor:", result);
    const { getPlanningGoalProgress } = await import("@/lib/planning");
    const full = await getPlanningGoalProgress(user.id, { range: { start: null, end: null, label: "Todo" } });
    const capped = await getPlanningGoalProgress(user.id, { range: { start: null, end: null, label: "Todo" }, movementLimit: 12 });
    expect(full.map((goal) => goal.actualAmount)).toEqual(capped.map((goal) => goal.actualAmount));
    expect(capped[0].movementCount).toBe(2000); expect(capped[0].movements).toHaveLength(12);
    await writeFile("outputs/planning-lists.json", JSON.stringify({ beforeBytes: Buffer.byteLength(JSON.stringify(full)), afterBytes: Buffer.byteLength(JSON.stringify(capped)), note: "Solo serialización; mismo cálculo y total de movimientos, antes se enviaban todos y se mostraban 12." }, null, 2));
  }, 60000);
});
