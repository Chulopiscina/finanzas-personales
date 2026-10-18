import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getDashboardData } from "@/lib/finance";
const url = process.env.TEST_DATABASE_URL;
if (url && (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || new URL(url).pathname !== "/finanzas_test")) throw new Error("Solo BD local desechable.");
describe.skipIf(!url)("periodos por fechas bancarias, no por archivos", () => {
  const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  afterAll(async () => { await db.$disconnect(); const { prisma } = await import("@/lib/prisma"); await prisma.$disconnect(); });
  async function fixture() {
    const user = await db.user.create({ data: { name: "Periodos", email: randomUUID() + "@example.test", passwordHash: "fixture" } });
    const account = await db.account.create({ data: { userId: user.id, name: "Banco" } });
    const movement = (date: string, concept: string, amount: number, extra = {}) => db.transaction.create({ data: { userId: user.id, accountId: account.id, date: new Date(date), concept, amount, type: amount > 0 ? "INCOME" : "EXPENSE", sourceHash: randomUUID(), ...extra } });
    return { user, account, movement };
  }
  it("separa dos nóminas del mismo mes, detecta inglés/catalán y excluye falsos disparadores", async () => {
    const { user, movement } = await fixture();
    await movement("2026-06-01", "Salary June", 1400);
    await movement("2026-06-10", "Compra", -100);
    await movement("2026-06-15", "BIZUM NOMINA", 10);
    await movement("2026-06-18", "NOMINES transfer", 12000, { isInternalTransfer: true, type: "TRANSFER" });
    const expense = await movement("2026-06-19", "Cena", -100);
    const refund = await movement("2026-06-20", "NOMINA reembolso", 50);
    await db.transactionReimbursement.create({ data: { expenseId: expense.id, reimbursementId: refund.id } });
    await movement("2026-06-29", "ABONAMENT NÒMINES", 1400);
    await movement("2026-06-30", "Compra", -30);
    await movement("2099-01-01", "Salary futura", 9999);
    const closed = await getDashboardData(user.id, null, "payroll-last-closed", "payroll");
    expect(closed.range.start).toContain("2026-06-01"); expect(closed.range.end).toContain("2026-06-29");
    expect(closed.metrics.totalIncome).toBe(1410); expect(closed.metrics.netExpenses).toBe(150); expect(closed.metrics.periodResult).toBe(1260);
    const current = await getDashboardData(user.id, null, "payroll-current", "payroll");
    expect(current.range.start).toContain("2026-06-29"); expect(current.metrics.totalIncome).toBe(1400); expect(current.metrics.netExpenses).toBe(30);
    expect((await getDashboardData(user.id, null, "payroll-all", "payroll")).targetMultiplier).toBe(2);
  });
  it("sin nóminas o sin ciclo cerrado no sustituye el periodo por todo el historial", async () => {
    const { user, movement } = await fixture();
    await movement("2026-06-05", "Compra", -20);
    const empty = await getDashboardData(user.id, null, "payroll-current", "payroll");
    expect(empty.metrics.netExpenses).toBe(0); expect(empty.periodLabel).toMatch(/sin nóminas/);
    await movement("2026-06-29", "NOMINA", 1400);
    const noClosed = await getDashboardData(user.id, null, "payroll-last-closed", "payroll");
    expect(noClosed.metrics.totalIncome).toBe(0); expect(noClosed.periodLabel).toMatch(/no hay un ciclo cerrado/);
  });
});
