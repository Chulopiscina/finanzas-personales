import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname !== "/finanzas_test") throw new Error("Las pruebas solo admiten la BD local finanzas_test.");
  process.env.DATABASE_URL = url; process.env.DIRECT_URL = url;
}
describe.skipIf(!url)("PostgreSQL real y confirmación atómica", () => {
  const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  let owner: string, other: string, account: string;
  beforeAll(async () => {
    const user = await db.user.create({ data: { name: "Fixture", email: randomUUID() + "@example.test", passwordHash: "synthetic-test-only" } }); owner = user.id;
    other = (await db.user.create({ data: { name: "Other", email: randomUUID() + "@example.test", passwordHash: "synthetic-test-only" } })).id;
    account = (await db.account.create({ data: { userId: owner, name: "Ficticia" } })).id;
  });
  afterAll(async () => { await db.$disconnect(); const { prisma } = await import("@/lib/prisma"); await prisma.$disconnect(); });
  const preview = (amounts = [-10, -10]) => ({ bankName: "Fixture", confidence: "media", validationStatus: "aviso", movements: amounts.map((amount) => ({ date: "2026-06-01T00:00:00.000Z", concept: "Prueba", amount, balance: null, categoryName: "Otros", type: "EXPENSE", sourceHash: randomUUID(), raw: {} })) });
  async function statement(data = preview()) {
    return db.importHistory.create({ data: { userId: owner, accountId: account, fileName: "fixture.csv", fileHash: randomUUID(), rowCount: data.movements.length, insertedRows: 0, duplicateRows: 0, status: "PENDING", previewData: data } });
  }
  it("rechaza otro usuario sin insertar movimientos", async () => {
    const { confirmStatement } = await import("@/lib/import-service"); const item = await statement();
    await expect(confirmStatement(item.id, { id: other, role: "USER" }, false)).rejects.toMatchObject({ status: 404 });
    expect(await db.transaction.count({ where: { importHistoryId: item.id } })).toBe(0);
  });
  it("confirma dos operaciones iguales, reintenta y evita duplicados PDF/CSV", async () => {
    const { confirmStatement } = await import("@/lib/import-service"); const item = await statement();
    const result = await confirmStatement(item.id, { id: owner, role: "USER" }, false);
    expect(result.insertedRows).toBe(2);
    const again = await confirmStatement(item.id, { id: owner, role: "USER" }, false); expect(again.insertedRows).toBe(2);
    const same = await statement(); expect((await confirmStatement(same.id, { id: owner, role: "USER" }, false)).duplicateRows).toBe(2);
  });
  it("revierte toda la transacción si falla un importe", async () => {
    const { confirmStatement } = await import("@/lib/import-service"); const item = await statement(preview([-5, -0.001]));
    await expect(confirmStatement(item.id, { id: owner, role: "USER" }, false)).rejects.toThrow();
    expect(await db.transaction.count({ where: { importHistoryId: item.id } })).toBe(0);
    expect((await db.importHistory.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("PENDING");
  });
  it("serializa dos confirmaciones simultáneas del mismo extracto", async () => {
    const { confirmStatement } = await import("@/lib/import-service"); const item = await statement(preview([-12.34]));
    const results = await Promise.all([confirmStatement(item.id, { id: owner, role: "USER" }, false), confirmStatement(item.id, { id: owner, role: "USER" }, false)]);
    expect(results.map((result) => result.insertedRows)).toEqual([1, 1]);
    expect(await db.transaction.count({ where: { importHistoryId: item.id } })).toBe(1);
  });
  it("respeta el orden del extracto en operaciones del mismo día", async () => {
    const local = await db.account.create({ data: { userId: owner, name: randomUUID() } });
    const date = new Date("2026-06-30"), createdAt = new Date("2026-07-01");
    await db.transaction.createMany({ data: [
      { id: "z-" + randomUUID(), userId: owner, accountId: local.id, date, createdAt, concept: "Primera", amount: -10, balance: 90, type: "EXPENSE", sourceHash: randomUUID(), raw: { statementSequence: 0 } },
      { id: "a-" + randomUUID(), userId: owner, accountId: local.id, date, createdAt, concept: "Segunda", amount: -20, balance: 70, type: "EXPENSE", sourceHash: randomUUID(), raw: { statementSequence: 1 } }
    ] });
    const { getAccountBalances } = await import("@/lib/finance");
    expect(Number((await getAccountBalances(owner, [local.id]))[0].currentBalance)).toBe(70);
  });
  it("calcula saldo ancla con operaciones posteriores mediante SQL", async () => {
    const local = await db.account.create({ data: { userId: owner, name: randomUUID() } });
    await db.transaction.create({ data: { userId: owner, accountId: local.id, date: new Date("2026-05-01"), concept: "Ancla", amount: 100, balance: 100, type: "INCOME", sourceHash: randomUUID() } });
    await db.transaction.create({ data: { userId: owner, accountId: local.id, date: new Date("2026-06-01"), concept: "Posterior", amount: -20, type: "EXPENSE", sourceHash: randomUUID() } });
    const { getAccountBalances } = await import("@/lib/finance");
    expect(Number((await getAccountBalances(owner, [local.id]))[0].currentBalance)).toBe(80);
    expect(await getAccountBalances(other, [local.id])).toEqual([]);
  });
});
