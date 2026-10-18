import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
const url = process.env.TEST_DATABASE_URL;
if (url) { const u = new URL(url); if (!["localhost", "127.0.0.1"].includes(u.hostname) || u.pathname !== "/finanzas_test") throw new Error("BD de pruebas no válida"); process.env.DATABASE_URL = url; }
describe.skipIf(!url)("planificación y dashboard sobre PostgreSQL", () => {
  const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  afterAll(async () => { await db.$disconnect(); const { prisma } = await import("@/lib/prisma"); await prisma.$disconnect(); });
  it("comparte aportaciones, reembolsos y pares sin duplicar asociaciones manuales", async () => {
    const user = await db.user.create({ data: { name: "Planning", email: randomUUID() + "@example.test", passwordHash: "synthetic" } });
    const a = await db.account.create({ data: { userId: user.id, name: "Banco" } }); const b = await db.account.create({ data: { userId: user.id, name: "Ahorro", type: "SAVINGS" } });
    const category = await db.category.create({ data: { userId: user.id, name: "Ahorro", type: "SAVINGS", color: "#22c55e", icon: "wallet" } });
    const movement = (accountId: string, amount: number, extra = {}) => db.transaction.create({ data: { userId: user.id, accountId, amount, date: new Date("2026-06-05"), concept: "Fixture", type: amount < 0 ? "EXPENSE" : "INCOME", sourceHash: randomUUID(), ...extra } });
    const expense = await movement(a.id, -100, { categoryId: category.id });
    const refund = await movement(a.id, 30); await db.transactionReimbursement.create({ data: { reimbursementId: refund.id, expenseId: expense.id } });
    const group = "internal-" + randomUUID();
    const out = await movement(a.id, -50, { type: "TRANSFER", isInternalTransfer: true, internalTransferGroupId: group });
    const incoming = await movement(b.id, 50, { type: "TRANSFER", isInternalTransfer: true, internalTransferGroupId: group });
    await db.planningGoal.create({ data: { userId: user.id, name: "Objetivo", type: "SAVINGS", targetAmount: 300, showInDashboard: true,
      categories: { create: { categoryId: category.id } }, transactions: { create: [{ transactionId: expense.id }, { transactionId: out.id, includeInternalTransfer: true }, { transactionId: incoming.id, includeInternalTransfer: true }] } } });
    const { getPlanningGoalProgress } = await import("@/lib/planning"); const { getDashboardData } = await import("@/lib/finance");
    const progress = await getPlanningGoalProgress(user.id, { range: { start: new Date("2026-06-01"), end: new Date("2026-07-01"), label: "Junio" } });
    expect(progress[0].actualAmount).toBe(120);
    expect(progress[0].movements.find((m) => m.id === expense.id)?.source).toBe("both");
    const dashboard = await getDashboardData(user.id);
    expect(dashboard.savingsGoal.actualAmount).toBe(120);
    expect(dashboard.metrics.netExpenses).toBe(70);
    expect(dashboard.metrics.internalTransferTotal).toBe(50);
    expect(dashboard.metrics.currentBalance).toBe(-70);
    expect(dashboard.charts.monthly[0].expenses).toBe(70);
    expect(dashboard.details.grossExpenses).toEqual([]);
  });
  it("limita intentos de login persistentemente y atómicamente", async () => {
    const { checkLoginRateLimit } = await import("@/lib/login-rate-limit");
    const headers = new Headers({ "x-vercel-forwarded-for": "127.0.0.88" });
    const email = randomUUID() + "@example.test";
    const results = await Promise.all(Array.from({ length: 12 }, () => checkLoginRateLimit(email, headers)));
    expect(results.filter((row) => row.allowed)).toHaveLength(10);
    expect(results[0].retryAfter).toBeGreaterThan(0);
  });
  it("descuenta en julio el reembolso de una aportación manual de junio", async () => {
    const user = await db.user.create({ data: { name: "Refund", email: randomUUID() + "@example.test", passwordHash: "synthetic" } });
    const account = await db.account.create({ data: { userId: user.id, name: "Banco" } });
    const expense = await db.transaction.create({ data: { userId: user.id, accountId: account.id, date: new Date("2026-06-20"), amount: -100, concept: "Aportación", type: "EXPENSE", sourceHash: randomUUID() } });
    const refund = await db.transaction.create({ data: { userId: user.id, accountId: account.id, date: new Date("2026-07-02"), amount: 30, concept: "Devolución", type: "INCOME", sourceHash: randomUUID() } });
    await db.transactionReimbursement.create({ data: { expenseId: expense.id, reimbursementId: refund.id } });
    await db.planningGoal.create({ data: { userId: user.id, name: "Manual", type: "SAVINGS", targetAmount: 100, transactions: { create: { transactionId: expense.id } } } });
    const { getPlanningGoalProgress } = await import("@/lib/planning"); const { getDashboardData } = await import("@/lib/finance");
    const progress = await getPlanningGoalProgress(user.id, { range: { start: new Date("2026-07-01"), end: new Date("2026-08-01"), label: "Julio" } });
    expect(progress[0].actualAmount).toBe(-30);
    expect((await getDashboardData(user.id)).savingsGoal.actualAmount).toBe(-30);
  });
});
