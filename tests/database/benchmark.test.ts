import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { sumMoney } from "@/lib/money";
const url = process.env.TEST_DATABASE_URL;
if (url) { const u = new URL(url); if (!["localhost", "127.0.0.1"].includes(u.hostname) || u.pathname !== "/finanzas_test") throw new Error("BD de pruebas no válida"); process.env.DATABASE_URL = url; }
describe.skipIf(!url)("medición local de saldos", () => {
  const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  afterAll(async () => { await db.$disconnect(); const { prisma } = await import("@/lib/prisma"); await prisma.$disconnect(); });
  it("compara carga histórica y agregación sin alterar datos reales", async () => {
    const user = await db.user.create({ data: { name: "Benchmark", email: randomUUID() + "@example.test", passwordHash: "synthetic" } });
    const account = await db.account.create({ data: { userId: user.id, name: "Medición" } });
    const results = [];
    const { getAccountBalances } = await import("@/lib/finance");
    for (const size of [1000, 10000]) {
      await db.transaction.createMany({ data: Array.from({ length: size === 1000 ? 1000 : 9000 }, (_, i) => ({ userId: user.id, accountId: account.id, date: new Date("2026-06-01"), concept: "Ficticio", amount: "0.01", type: "INCOME", sourceHash: size + "-" + i })) });
      const oldTimes = [], newTimes = []; let oldBytes = 0, newBytes = 0;
      for (let repeat = 0; repeat < 4; repeat++) {
        let start = performance.now();
        const rows = await db.transaction.findMany({ where: { userId: user.id }, select: { accountId: true, amount: true, balance: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
        expect(sumMoney(rows, (row) => row.amount)).toBe(size / 100); oldTimes.push(performance.now() - start); oldBytes = Buffer.byteLength(JSON.stringify(rows));
        start = performance.now(); const balances = await getAccountBalances(user.id, [account.id]);
        expect(Number(balances[0].currentBalance)).toBe(size / 100); newTimes.push(performance.now() - start); newBytes = Buffer.byteLength(JSON.stringify(balances));
      }
      const median = (values: number[]) => Math.round([...values].slice(1).sort((a, b) => a - b)[1] * 100) / 100;
      results.push({ movements: size, previousRows: size, newRows: 1, previousBytes: oldBytes, newBytes, previousMedianMs: median(oldTimes), newMedianMs: median(newTimes) });
    }
    await mkdir("outputs", { recursive: true }); await writeFile("outputs/benchmark.json", JSON.stringify(results, null, 2));
    console.info("Medición PostgreSQL local (no extrapolable a Vercel):", results);
  }, 30000);
});
