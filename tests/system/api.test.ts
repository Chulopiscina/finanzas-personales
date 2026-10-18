import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
const app = process.env.TEST_APP_URL;
const url = process.env.TEST_DATABASE_URL;
if (app && (!url || !["localhost", "127.0.0.1"].includes(new URL(app).hostname) || new URL(url).pathname !== "/finanzas_test")) throw new Error("Solo se permiten pruebas HTTP en el entorno local aislado.");
describe.skipIf(!app)("HTTP real: login, autorización, transferencias y sesiones", () => {
  const db = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  const password = "Fixture-" + randomUUID();
  let email: string, a: string, b: string, accountA: string, accountB: string, foreignAccount: string, cookie: string;
  beforeAll(async () => {
    email = randomUUID() + "@example.test";
    a = (await db.user.create({ data: { name: "Alice", email, passwordHash: await bcrypt.hash(password, 12) } })).id;
    b = (await db.user.create({ data: { name: "Bob", email: randomUUID() + "@example.test", passwordHash: "synthetic" } })).id;
    accountA = (await db.account.create({ data: { userId: a, name: "Banco" } })).id;
    accountB = (await db.account.create({ data: { userId: a, name: "Ahorro" } })).id;
    foreignAccount = (await db.account.create({ data: { userId: b, name: "Privada" } })).id;
    const response = await fetch(app + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: app! }, body: JSON.stringify({ email, password }) });
    expect(response.status).toBe(200);
    cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    expect(cookie).toContain("pf_session=");
  }, 20000);
  afterAll(async () => { await db.$disconnect(); });
  async function call(path: string, method = "GET", body?: object) {
    return fetch(app + path, { method, redirect: "manual", headers: { Cookie: cookie, Origin: app!, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  it("rechaza cuentas y categorías de otro usuario", async () => {
    const category = await db.category.create({ data: { userId: b, name: "Privada " + randomUUID(), type: "EXPENSE", color: "#fff", icon: "circle" } });
    expect((await call("/api/accounts/" + foreignAccount, "PATCH", { name: "No autorizado" })).status).toBe(404);
    const data = await (await call("/api/transactions")).json();
    expect(data.categories.some((item: { id: string }) => item.id === category.id)).toBe(false);
    expect((await call("/api/transactions?userId=" + b)).status).toBe(403);
    expect((await call("/api/admin/users")).status).toBe(403);
  });
  it("vincula dos patas y restaura los tipos al quitar interna", async () => {
    const out = await db.transaction.create({ data: { userId: a, accountId: accountA, date: new Date(), concept: "Transferencia prueba", amount: -11900, type: "EXPENSE", sourceHash: randomUUID() } });
    const incoming = await db.transaction.create({ data: { userId: a, accountId: accountB, date: new Date(), concept: "Transferencia prueba", amount: 11900, type: "INCOME", sourceHash: randomUUID() } });
    expect((await call(`/api/transactions/${out.id}`, "PATCH", { isInternalTransfer: true, internalTransferCounterAccountId: accountB, counterpartTransactionId: incoming.id })).status).toBe(200);
    expect((await db.transaction.findUniqueOrThrow({ where: { id: incoming.id } })).isInternalTransfer).toBe(true);
    expect((await call(`/api/transactions/${out.id}`, "PATCH", { amount: -11800 })).status).toBe(400);
    expect((await call(`/api/transactions/${out.id}`, "PATCH", { isInternalTransfer: false })).status).toBe(200);
    expect((await db.transaction.findUniqueOrThrow({ where: { id: out.id } })).type).toBe("EXPENSE");
    expect((await db.transaction.findUniqueOrThrow({ where: { id: incoming.id } })).type).toBe("INCOME");
  });
  it("muestra dashboard con consultas reales y rechaza CSRF", async () => {
    const response = await call("/dashboard"); expect(response.status).toBe(200);
    const html = await response.text();
    const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<!--.*?-->/g, "");
    expect(heading).toContain("Hola Alice");
    const bad = await fetch(app + "/api/accounts", { method: "POST", headers: { Cookie: cookie, Origin: "https://foreign.example", "Content-Type": "application/json" }, body: JSON.stringify({ name: "Bad" }) });
    expect(bad.status).toBe(403);
  });
  it("bloquea recursos ajenos de planificación, presupuesto, pagos, extractos y movimientos", async () => {
    const goal = await db.planningGoal.create({ data: { userId: b, name: "Privado", type: "SAVINGS", targetAmount: 100 } });
    const budget = await db.monthlyBudget.create({ data: { userId: b, month: new Date("2026-06-01") } });
    const recurring = await db.recurringPayment.create({ data: { userId: b, name: "Privado", amount: 10, nextChargeDate: new Date("2026-12-01"), frequency: "MONTHLY" } });
    const statement = await db.importHistory.create({ data: { userId: b, accountId: foreignAccount, fileName: "private.csv", fileHash: randomUUID(), fileContent: "private-content", rowCount: 0, insertedRows: 0, duplicateRows: 0, status: "PENDING" } });
    const movement = await db.transaction.create({ data: { userId: b, accountId: foreignAccount, date: new Date(), concept: "Privado", amount: -10, type: "EXPENSE", sourceHash: randomUUID() } });
    const cases: [string, string, object?][] = [
      ["/api/planning/" + goal.id, "PATCH", { name: "Bad" }],
      ["/api/budgets/" + budget.id, "DELETE"],
      ["/api/recurring-payments/" + recurring.id, "DELETE"],
      ["/api/imports/" + statement.id + "/preview", "GET"],
      ["/api/imports/" + statement.id + "/download", "GET"],
      ["/api/imports/" + statement.id + "/confirm", "POST", {}],
      ["/api/imports/" + statement.id, "DELETE"],
      ["/api/transactions/" + movement.id, "PATCH", { cleanDescription: "Bad" }],
      ["/api/transactions/" + movement.id + "/planning", "PATCH", { goals: [] }],
      ["/api/transactions/" + movement.id + "/reimbursements", "PATCH", { expenseIds: [] }]
    ];
    for (const [path, method, body] of cases) {
      const response = await call(path, method, body);
      expect([403, 404], path).toContain(response.status);
      expect(await response.text()).not.toContain("private-content");
    }
    expect(await db.monthlyBudget.count({ where: { id: budget.id } })).toBe(1);
    expect(await db.importHistory.count({ where: { id: statement.id } })).toBe(1);
  });
  it("prorratea reembolsos y rechaza gastos de otro usuario", async () => {
    const make = (amount: number, userId = a, accountId = accountA) => db.transaction.create({ data: { userId, accountId, date: new Date(), concept: "Reembolso fixture", amount, type: amount > 0 ? "INCOME" : "EXPENSE", sourceHash: randomUUID() } });
    const expenseA = await make(-100), expenseB = await make(-100), refund = await make(50);
    const foreign = await make(-100, b, foreignAccount);
    const path = `/api/transactions/${refund.id}/reimbursements`;
    expect((await call(path, "PATCH", { expenseIds: [foreign.id] })).status).toBe(400);
    expect((await call(path, "PATCH", { expenseIds: [expenseA.id, expenseB.id] })).status).toBe(200);
    expect(await db.transactionReimbursement.count({ where: { reimbursementId: refund.id } })).toBe(2);
    expect((await call(`/api/transactions/${expenseA.id}`, "PATCH", { amount: -10 })).status).toBe(400);
    expect((await call(path, "PATCH", { expenseIds: [] })).status).toBe(200);
    expect(await db.transactionReimbursement.count({ where: { reimbursementId: refund.id } })).toBe(0);
  });
  it("invalida la sesión anterior al cambiar contraseña", async () => {
    expect((await call("/api/profile", "PATCH", { currentPassword: password, newPassword: "New-" + randomUUID() + "A1" })).status).toBe(200);
    expect((await call("/api/auth/me")).status).toBe(401);
  });
});
