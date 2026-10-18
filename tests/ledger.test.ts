import { describe, expect, it } from "vitest";
import { Prisma, type Account } from "@prisma/client";
import { accountingType, ledgerTotals, refundShares, savingsContribution } from "@/lib/ledger";
import { cents, euros, sumMoney } from "@/lib/money";
import { accountBalance, buildMonthlyRows, buildBudgetSummary, rangeIncludesBudgetMonth } from "@/lib/finance";
import { nextRecurringPaymentDate } from "@/lib/recurring-payments";

const movement = (id: string, amount: number, date = "2026-06-01") => ({ id, amount, date: new Date(date), isInternalTransfer: false, categoryId: "food", category: { name: "Comida" } });

describe("contabilidad exacta", () => {
  it("suma céntimos sin error y rechaza fracciones de céntimo", () => {
    expect(sumMoney(Array.from({ length: 10000 }, () => "0.01"), (x) => x)).toBe(100);
    expect(cents(new Prisma.Decimal("453.86"))).toBe(45386);
    expect(euros(45386)).toBe(453.86);
    expect(() => cents("0.001")).toThrow();
  });
  it("cuenta transferencias externas como gasto/ingreso y excluye internas", () => {
    const external = { ...movement("rent", -600), type: "TRANSFER" };
    expect(accountingType(external)).toBe("EXPENSE");
    expect(ledgerTotals([external, { ...movement("out", -12000), isInternalTransfer: true }, { ...movement("in", 12000), isInternalTransfer: true }])).toEqual({ income: 0, grossExpenses: 600, reimbursements: 0, netExpenses: 600, result: -600 });
  });
  it("reparte un reembolso compartido una sola vez, conservando el céntimo sobrante", () => {
    const expenses = [movement("a", -100), movement("b", -100), movement("c", -100)];
    const refund = { ...movement("refund", 100), reimbursementLinks: expenses.map((expense) => ({ expenseId: expense.id, expense })) };
    expect(refundShares(refund).map((share) => share.amount)).toEqual([33.34, 33.33, 33.33]);
    expect(ledgerTotals([...expenses, refund]).netExpenses).toBe(200);
  });
  it("usa fecha de recepción del reembolso también en gráficos y presupuestos", () => {
    const expense = movement("expense", -100, "2026-05-20");
    const refund = { ...movement("refund", 50, "2026-06-03"), reimbursementLinks: [{ expenseId: expense.id, expense }] };
    expect(ledgerTotals([refund]).netExpenses).toBe(-50);
    const monthly = buildMonthlyRows([refund] as unknown as Parameters<typeof buildMonthlyRows>[0]);
    expect(monthly[0].netExpenses).toBe(-50);
    const budget = { month: new Date("2026-06-01"), accountId: null, expectedIncome: 1400, fixedLimit: 0, variableLimit: 300, extraLimit: 0, savingsGoal: 100, categories: [] };
    expect(buildBudgetSummary([budget], [refund] as unknown as Parameters<typeof buildBudgetSummary>[1]).spent).toBe(-50);
  });
  it("suma operaciones posteriores al saldo ancla, sin sumar cierres antiguos", () => {
    const account = { id: "a", initialBalance: new Prisma.Decimal(0) } as Account;
    const rows = [{ accountId: "a", amount: new Prisma.Decimal(-20), balance: null }, { accountId: "a", amount: new Prisma.Decimal(100), balance: new Prisma.Decimal(100) }, { accountId: "a", amount: new Prisma.Decimal(1000), balance: new Prisma.Decimal(1000) }];
    expect(accountBalance(account, rows)).toBe(80);
    expect(accountBalance(account, [{ accountId: "a", amount: new Prisma.Decimal(12000), balance: null }])).toBe(12000);
  });
  it("incluye el presupuesto del mes de un ciclo cerrado dentro del mismo mes", () => {
    expect(rangeIncludesBudgetMonth(new Date("2026-06-01"), { start: new Date("2026-06-01"), end: new Date("2026-06-29"), label: "test" }, "payroll-last-closed")).toBe(true);
  });
  it("cuenta aportaciones positivas y una sola vez las dos patas de una transferencia", () => {
    const transfer = { ...movement("out", -100), isInternalTransfer: true, internalTransferGroupId: "pair", includeInternalTransfer: true };
    expect(savingsContribution([transfer, { ...transfer, id: "in", amount: 100 }])).toBe(100);
    expect(savingsContribution([{ ...transfer, includeInternalTransfer: false }])).toBe(0);
    expect(savingsContribution([movement("save", -100)])).toBe(100);
    expect(savingsContribution([movement("salary", 1400)])).toBe(0);
  });
  it("mantiene el día ancla mensual y anual", () => {
    expect(nextRecurringPaymentDate(new Date("2026-01-31"), "MONTHLY", new Date("2026-03-01"))?.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(nextRecurringPaymentDate(new Date("2020-08-15"), "ANNUAL", new Date("2026-09-01"))?.toISOString().slice(0, 10)).toBe("2027-08-15");
    expect(nextRecurringPaymentDate(new Date("2026-01-01"), "ONCE", new Date("2026-02-01"))).toBeNull();
  });
});
