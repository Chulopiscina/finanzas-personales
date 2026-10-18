import { cents, euros, allocateCents } from "@/lib/money";

export type LedgerMovement = {
  id: string;
  date: Date;
  amount: unknown;
  type?: string;
  accountId?: string;
  categoryId?: string | null;
  category?: { name: string; color?: string; type?: string } | null;
  isFixedExpense?: boolean;
  isInternalTransfer: boolean;
  internalTransferGroupId?: string | null;
  reimbursementLinks?: Array<{ expenseId: string; expense?: LedgerMovement }>;
};

export function accountingType(tx: Pick<LedgerMovement, "amount" | "isInternalTransfer">) {
  return tx.isInternalTransfer ? "TRANSFER" : cents(tx.amount) >= 0 ? "INCOME" : "EXPENSE";
}
export function isRefund(tx: LedgerMovement) {
  return !tx.isInternalTransfer && cents(tx.amount) > 0 && Boolean(tx.reimbursementLinks?.length);
}
export function grossExpense(tx: LedgerMovement) {
  return !tx.isInternalTransfer && cents(tx.amount) < 0 ? euros(-cents(tx.amount)) : 0;
}
export function income(tx: LedgerMovement) {
  return !tx.isInternalTransfer && cents(tx.amount) > 0 && !isRefund(tx) ? euros(cents(tx.amount)) : 0;
}

export function refundShares(tx: LedgerMovement) {
  if (!isRefund(tx)) return [];
  const expenses = [...new Map((tx.reimbursementLinks ?? []).filter((link) => link.expense && grossExpense(link.expense) > 0).map((link) => [link.expenseId, link.expense!])).values()];
  const allocation = allocateCents(cents(tx.amount), expenses.map((expense) => ({ id: expense.id, cents: cents(grossExpense(expense)) })));
  return expenses.map((expense) => ({ expense, amount: euros(allocation.get(expense.id) ?? 0) }));
}

// Cash basis: a refund reduces spending on its receipt date, in the original expense category.
export function spendingEntries(tx: LedgerMovement) {
  if (grossExpense(tx) > 0) return [{ movement: tx, source: tx, amount: grossExpense(tx) }];
  return refundShares(tx).map(({ expense, amount }) => ({ movement: tx, source: expense, amount: -amount }));
}

export function ledgerTotals(transactions: LedgerMovement[]) {
  let realIncome = 0, gross = 0, refunds = 0;
  for (const tx of transactions) {
    realIncome += cents(income(tx));
    gross += cents(grossExpense(tx));
    if (isRefund(tx)) refunds += cents(tx.amount);
  }
  return { income: euros(realIncome), grossExpenses: euros(gross), reimbursements: euros(refunds), netExpenses: euros(gross - refunds), result: euros(realIncome - gross + refunds) };
}

export function savingsContribution(transactions: Array<LedgerMovement & { includeInternalTransfer?: boolean }>) {
  const seen = new Set<string>();
  let total = 0;
  for (const tx of transactions) {
    if (isRefund(tx) || (!tx.isInternalTransfer && cents(tx.amount) >= 0)) continue;
    if (tx.isInternalTransfer && !tx.includeInternalTransfer) continue;
    const key = tx.isInternalTransfer ? tx.internalTransferGroupId ?? tx.id : tx.id;
    if (seen.has(key)) continue;
    seen.add(key);
    total += Math.abs(cents(tx.amount));
  }
  return euros(total);
}
