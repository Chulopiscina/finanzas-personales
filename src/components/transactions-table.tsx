"use client";

import { HandCoins, MoreHorizontal, Search, Target, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";

type CategoryType = "INCOME" | "EXPENSE" | "SAVINGS" | "TRANSFER" | "OTHER";
type Category = { id: string; name: string; color: string; type?: CategoryType };
type Account = { id: string; name: string; isArchived?: boolean };
type ImportOption = { id: string; fileName: string };
type GoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
type PlanningGoalOption = { id: string; name: string; color: string | null; status: GoalStatus };
type PlanningGoalAssociation = { goalId: string; includeInternalTransfer: boolean; goal: PlanningGoalOption };

type ReimbursementAssociation = {
  expenseId: string;
  expense: { id: string; date: string | Date; concept: string; cleanDescription: string | null; amount: unknown; account: Account | null; category: Category | null };
};

type TransactionRow = {
  id: string;
  date: string;
  concept: string;
  cleanDescription: string | null;
  amount: number;
  balance: number | null;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  categoryId: string | null;
  category: Category | null;
  accountId: string;
  account: Account | null;
  importHistory: ImportOption | null;
  planningGoals: PlanningGoalAssociation[];
  reimbursementLinks: ReimbursementAssociation[];
  reimbursedByLinks: Array<{ reimbursementId: string; reimbursement: { concept: string; cleanDescription: string | null; amount: unknown } }>;
  isInternalTransfer: boolean;
  isFixedExpense: boolean;
  internalTransferCounterAccountId: string | null;
};

type QuickCategoryState = {
  transactionId: string;
  name: string;
  type: CategoryType;
  color: string;
  error: string;
};

type InternalTransferState = {
  transactionId: string;
  counterAccountId: string;
  counterpartTransactionId: string;
  error: string;
};

type PlanningAssociationState = {
  transactionId: string;
  selectedGoalIds: string[];
  includeInternalTransfer: boolean;
  error: string;
};

type ReimbursementState = {
  transactionId: string;
  selectedExpenseIds: string[];
  error: string;
};

const categoryTypeLabels: Record<CategoryType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  SAVINGS: "Ahorro",
  TRANSFER: "Transferencia",
  OTHER: "Otro"
};

function toggleId(items: string[], id: string) {
  return items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
}

export function TransactionsTable({
  initialTransactions,
  categories: initialCategories,
  accounts,
  imports,
  planningGoals,
  initialFilters
}: {
  initialTransactions: TransactionRow[];
  categories: Category[];
  accounts: Account[];
  imports: ImportOption[];
  planningGoals: PlanningGoalOption[];
  initialFilters: { accountId: string; categoryId: string; type: string; importId: string; planningGoalId: string };
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [quickCategory, setQuickCategory] = useState<QuickCategoryState | null>(null);
  const [internalTransfer, setInternalTransfer] = useState<InternalTransferState | null>(null);
  const [planningAssociation, setPlanningAssociation] = useState<PlanningAssociationState | null>(null);
  const [reimbursement, setReimbursement] = useState<ReimbursementState | null>(null);
  const [counterpartSearch, setCounterpartSearch] = useState("");
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      const goalNames = tx.planningGoals.map((item) => item.goal.name).join(" ");
      const reimbursementText = tx.reimbursementLinks.length > 0 ? "reembolso" : "";
      const expenseKindText = tx.type === "EXPENSE" ? (tx.isFixedExpense ? "gasto fijo fijo" : "gasto variable variable") : "";
      const matchesQuery =
        !q ||
        [tx.concept, tx.cleanDescription, tx.category?.name, tx.account?.name, tx.type, goalNames, reimbursementText, expenseKindText]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesPlanningGoal =
        !filters.planningGoalId ||
        (filters.planningGoalId === "__none" && tx.planningGoals.length === 0) ||
        (filters.planningGoalId === "__any" && tx.planningGoals.length > 0) ||
        tx.planningGoals.some((item) => item.goalId === filters.planningGoalId);

      return (
        matchesQuery &&
        (!filters.accountId || tx.accountId === filters.accountId) &&
        (!filters.categoryId || tx.categoryId === filters.categoryId) &&
        (!filters.type || tx.type === filters.type) &&
        (!filters.importId || tx.importHistory?.id === filters.importId) &&
        matchesPlanningGoal
      );
    });
  }, [query, transactions, filters]);

  async function patchTransaction(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    const response = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    setSavingId(null);
    return response.ok ? (payload.transaction as TransactionRow) : null;
  }

  async function applyCategory(id: string, categoryId: string, fallbackCategory?: Category) {
    const updated = await patchTransaction(id, { categoryId: categoryId || null });
    if (!updated) return;
    const category = categories.find((item) => item.id === categoryId) ?? fallbackCategory ?? updated.category ?? null;
    setTransactions((current) =>
      current.map((tx) => (tx.id === id ? { ...tx, categoryId: category?.id ?? null, category } : tx))
    );
  }

  function updateCategory(id: string, categoryId: string) {
    if (categoryId === "__new") {
      const tx = transactions.find((item) => item.id === id);
      setQuickCategory({
        transactionId: id,
        name: "",
        type: tx?.type === "INCOME" ? "INCOME" : tx?.type === "TRANSFER" ? "TRANSFER" : "EXPENSE",
        color: "#94a3b8",
        error: ""
      });
      return;
    }
    void applyCategory(id, categoryId);
  }

  async function createQuickCategory() {
    if (!quickCategory) return;
    const name = quickCategory.name.trim();
    if (!name) {
      setQuickCategory({ ...quickCategory, error: "El nombre es obligatorio." });
      return;
    }

    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: quickCategory.type, color: quickCategory.color })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.category) {
      setQuickCategory({ ...quickCategory, error: payload.error ?? "No se pudo crear la categoría." });
      return;
    }

    const newCategory = payload.category as Category;
    setCategories((current) => [...current, newCategory]);
    setQuickCategory(null);
    await applyCategory(quickCategory.transactionId, newCategory.id, newCategory);
  }

  async function updateAccount(id: string, accountId: string) {
    const updated = await patchTransaction(id, { accountId });
    if (!updated) return;
    const account = accounts.find((item) => item.id === accountId) ?? updated.account ?? null;
    setTransactions((current) => current.map((tx) => (tx.id === id ? { ...tx, accountId, account } : tx)));
  }

  async function updateCleanDescription(id: string, value: string) {
    const cleanDescription = value.trim() || null;
    const updated = await patchTransaction(id, { cleanDescription });
    if (!updated) return;
    setTransactions((current) => current.map((tx) => (tx.id === id ? { ...tx, cleanDescription } : tx)));
  }

  async function updateExpenseKind(id: string, value: string) {
    const isFixedExpense = value === "fixed";
    const updated = await patchTransaction(id, { isFixedExpense });
    if (!updated) return;
    setTransactions((current) => current.map((tx) => (tx.id === id ? { ...tx, isFixedExpense } : tx)));
  }

  function openInternalTransfer(tx: TransactionRow) {
    const defaultCounter = accounts.find((account) => account.id !== tx.accountId)?.id ?? "";
    setCounterpartSearch("");
    setInternalTransfer({
      transactionId: tx.id,
      counterAccountId: tx.internalTransferCounterAccountId ?? defaultCounter,
      counterpartTransactionId: "",
      error: ""
    });
  }

  async function saveInternalTransfer() {
    if (!internalTransfer) return;
    if (!internalTransfer.counterAccountId) {
      setInternalTransfer({ ...internalTransfer, error: "Elige la cuenta origen o destino." });
      return;
    }

    const updated = await patchTransaction(internalTransfer.transactionId, {
      isInternalTransfer: true,
      internalTransferCounterAccountId: internalTransfer.counterAccountId,
      counterpartTransactionId: internalTransfer.counterpartTransactionId || null
    });
    if (!updated) {
      setInternalTransfer({ ...internalTransfer, error: "No se pudo marcar como transferencia interna." });
      return;
    }

    setTransactions((current) =>
      current.map((tx) => {
        if (tx.id === updated.id) return { ...tx, ...updated };
        if (internalTransfer.counterpartTransactionId && tx.id === internalTransfer.counterpartTransactionId) {
          return { ...tx, type: "TRANSFER", isInternalTransfer: true, internalTransferCounterAccountId: updated.accountId };
        }
        return tx;
      })
    );
    setInternalTransfer(null);
  }

  async function clearInternalTransfer(tx: TransactionRow) {
    const updated = await patchTransaction(tx.id, { isInternalTransfer: false, internalTransferCounterAccountId: null });
    if (!updated) return;
    setTransactions((current) => current.map((item) => (item.id === tx.id ? { ...item, ...updated } : item)));
  }

  function openPlanningAssociation(tx: TransactionRow) {
    setPlanningAssociation({
      transactionId: tx.id,
      selectedGoalIds: tx.planningGoals.map((item) => item.goalId),
      includeInternalTransfer: tx.planningGoals.some((item) => item.includeInternalTransfer),
      error: ""
    });
  }

  async function savePlanningAssociation() {
    if (!planningAssociation) return;
    const tx = transactions.find((item) => item.id === planningAssociation.transactionId);
    if (!tx) return;

    setSavingId(tx.id);
    const response = await fetch(`/api/transactions/${tx.id}/planning`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goals: planningAssociation.selectedGoalIds.map((id) => ({
          id,
          includeInternalTransfer: tx.isInternalTransfer ? planningAssociation.includeInternalTransfer : false
        }))
      })
    });
    const payload = await response.json().catch(() => ({}));
    setSavingId(null);

    if (!response.ok || !payload.planningGoals) {
      setPlanningAssociation({ ...planningAssociation, error: payload.error ?? "No se pudieron actualizar los objetivos." });
      return;
    }

    setTransactions((current) => current.map((item) => (item.id === tx.id ? { ...item, planningGoals: payload.planningGoals as PlanningGoalAssociation[] } : item)));
    setPlanningAssociation(null);
  }
  function openReimbursement(tx: TransactionRow) {
    setReimbursement({ transactionId: tx.id, selectedExpenseIds: tx.reimbursementLinks.map((item) => item.expenseId), error: "" });
  }

  async function saveReimbursement() {
    if (!reimbursement) return;
    const tx = transactions.find((item) => item.id === reimbursement.transactionId);
    if (!tx) return;
    setSavingId(tx.id);
    const response = await fetch(`/api/transactions/${tx.id}/reimbursements`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseIds: reimbursement.selectedExpenseIds })
    });
    const payload = await response.json().catch(() => ({}));
    setSavingId(null);
    if (!response.ok || !payload.reimbursements) {
      setReimbursement({ ...reimbursement, error: payload.error ?? "No se pudo actualizar el reembolso." });
      return;
    }
    setTransactions((current) => current.map((item) => (item.id === tx.id ? { ...item, reimbursementLinks: payload.reimbursements as ReimbursementAssociation[] } : item)));
    setReimbursement(null);
  }

  const internalTransferSource = internalTransfer ? transactions.find((tx) => tx.id === internalTransfer.transactionId) ?? null : null;
  const planningSource = planningAssociation ? transactions.find((tx) => tx.id === planningAssociation.transactionId) ?? null : null;
  const reimbursementSource = reimbursement ? transactions.find((tx) => tx.id === reimbursement.transactionId) ?? null : null;
  const reimbursementCandidates = reimbursementSource ? transactions.filter((tx) => tx.type === "EXPENSE" && !tx.isInternalTransfer && tx.id !== reimbursementSource.id).slice(0, 80) : [];
  const counterpartQuery = counterpartSearch.trim().toLowerCase();
  const counterpartOptions = internalTransferSource
    ? transactions
        .filter((tx) => {
          if (tx.id === internalTransferSource.id || tx.accountId !== internalTransfer?.counterAccountId || Math.sign(tx.amount) !== -Math.sign(internalTransferSource.amount)) return false;
          const amountDiff = Math.abs(Math.abs(tx.amount) - Math.abs(internalTransferSource.amount));
          const dayDiff = Math.abs(new Date(tx.date).getTime() - new Date(internalTransferSource.date).getTime()) / 86_400_000;
          const closeMatch = amountDiff <= Math.max(1, Math.abs(internalTransferSource.amount) * 0.001) && dayDiff <= 14;
          const queryMatch = !counterpartQuery || [tx.concept, tx.cleanDescription, tx.account?.name, formatCurrency(tx.amount), formatDate(tx.date)].filter(Boolean).join(" ").toLowerCase().includes(counterpartQuery);
          return counterpartQuery ? queryMatch : closeMatch;
        })
        .sort((left, right) => {
          const leftAmountDiff = Math.abs(Math.abs(left.amount) - Math.abs(internalTransferSource.amount));
          const rightAmountDiff = Math.abs(Math.abs(right.amount) - Math.abs(internalTransferSource.amount));
          if (leftAmountDiff !== rightAmountDiff) return leftAmountDiff - rightAmountDiff;
          return Math.abs(new Date(left.date).getTime() - new Date(internalTransferSource.date).getTime()) - Math.abs(new Date(right.date).getTime() - new Date(internalTransferSource.date).getTime());
        })
        .slice(0, 12)
    : [];

  async function remove(id: string) {
    const confirmed = window.confirm("¿Eliminar este movimiento? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    const response = await fetch("/api/transactions/" + id, { method: "DELETE" });
    if (response.ok) setTransactions((current) => current.filter((tx) => tx.id !== id));
  }

  function movementType(tx: TransactionRow) {
    if (tx.isInternalTransfer) return { label: tx.amount >= 0 ? "Movimiento entre cuentas/efectivo" : "Transferencia interna", tone: "neutral" as const };
    if (tx.reimbursementLinks.length > 0) return { label: "Reembolso", tone: "success" as const };
    if (tx.type === "INCOME") return { label: "Ingreso", tone: "success" as const };
    if (tx.type === "EXPENSE") return { label: "Gasto", tone: "danger" as const };
    return { label: "Transferencia", tone: "neutral" as const };
  }

  function planningLabel(tx: TransactionRow) {
    if (tx.type === "EXPENSE" && !tx.isInternalTransfer) return tx.isFixedExpense ? "Fijo" : "Variable";
    if (tx.type === "TRANSFER" || tx.isInternalTransfer) return "Otro";
    return "Sin clasificar";
  }

  function planningTone(tx: TransactionRow) {
    if (tx.type === "EXPENSE" && !tx.isInternalTransfer) return tx.isFixedExpense ? "neutral" as const : "warning" as const;
    return "neutral" as const;
  }

  function goalsLabel(tx: TransactionRow) {
    if (tx.planningGoals.length === 0) return "Sin objetivo";
    if (tx.planningGoals.length === 1) return tx.planningGoals[0].goal.name;
    return String(tx.planningGoals.length) + " objetivos";
  }

  function goalsTitle(tx: TransactionRow) {
    return tx.planningGoals.map((item) => item.goal.name).join(", ");
  }

  function closeActions() {
    setOpenActionsId(null);
  }

  function ActionMenu({ tx, align = "right" }: { tx: TransactionRow; align?: "left" | "right" }) {
    const open = openActionsId === tx.id;
    return (
      <div className="relative inline-flex justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpenActionsId(open ? null : tx.id)} aria-expanded={open} aria-haspopup="menu" className="h-8 px-2 sm:px-3">
          <MoreHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Acciones</span>
        </Button>
        {open ? (
          <div className={(align === "right" ? "right-0" : "left-0") + " absolute top-10 z-20 w-64 rounded-lg border border-border bg-card p-1.5 text-left shadow-xl"} role="menu">
            <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-card-foreground hover:bg-muted" onClick={() => { closeActions(); openPlanningAssociation(tx); }} disabled={savingId === tx.id}>
              <Target className="h-4 w-4 text-muted-foreground" /> Asociar a objetivo
            </button>
            {tx.isInternalTransfer ? (
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-card-foreground hover:bg-muted" onClick={() => { closeActions(); void clearInternalTransfer(tx); }} disabled={savingId === tx.id}>
                Quitar transferencia interna
              </button>
            ) : (
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-card-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { closeActions(); openInternalTransfer(tx); }} disabled={savingId === tx.id || accounts.length < 2}>
                {tx.type === "INCOME" ? "Movimiento entre cuentas/efectivo" : "Marcar como transferencia interna"}
              </button>
            )}
            {tx.type === "INCOME" && tx.amount > 0 && !tx.isInternalTransfer ? (
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-card-foreground hover:bg-muted" onClick={() => { closeActions(); openReimbursement(tx); }} disabled={savingId === tx.id}>
                <HandCoins className="h-4 w-4 text-muted-foreground" /> {tx.reimbursementLinks.length > 0 ? "Editar reembolso" : "Marcar como reembolso"}
              </button>
            ) : null}
            <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10" onClick={() => { closeActions(); void remove(tx.id); }}>
              <Trash2 className="h-4 w-4" /> Eliminar movimiento
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Movimientos</h2>
            <p className="text-sm text-muted-foreground">{filtered.length} de {transactions.length} transacciones</p>
          </div>
          <label className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" className="pl-9" />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <Select value={filters.accountId} onChange={(event) => setFilters({ ...filters, accountId: event.target.value })}>
            <option value="">Todas las cuentas</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </Select>
          <Select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}>
            <option value="">Todas las categorías</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
          <Select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="">Todos los tipos</option>
            <option value="INCOME">Ingreso</option>
            <option value="EXPENSE">Gasto</option>
            <option value="TRANSFER">Transferencia</option>
          </Select>
          <Select value={filters.importId} onChange={(event) => setFilters({ ...filters, importId: event.target.value })}>
            <option value="">Todos los extractos</option>
            {imports.map((item) => <option key={item.id} value={item.id}>{item.fileName}</option>)}
          </Select>
          <Select value={filters.planningGoalId} onChange={(event) => setFilters({ ...filters, planningGoalId: event.target.value })}>
            <option value="">Todos los objetivos</option>
            <option value="__none">Sin objetivo</option>
            <option value="__any">Con objetivo</option>
            {planningGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
          </Select>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1360px] border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Concepto</th>
              <th className="px-4 py-3 font-medium">Cuenta</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 text-right font-medium">Importe</th>
              <th className="px-4 py-3 text-right font-medium">Saldo</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Planificación</th>
              <th className="px-4 py-3 font-medium">Objetivos</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => {
              const typeBadge = movementType(tx);
              const sourceText = tx.importHistory ? "Importado desde " + tx.importHistory.fileName : "Manual";
              return (
                <tr key={tx.id} className="border-t border-border align-middle transition hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(tx.date)}</td>
                  <td className="min-w-[280px] max-w-md px-4 py-3">
                    <Input defaultValue={tx.cleanDescription ?? tx.concept} onBlur={(event) => void updateCleanDescription(tx.id, event.target.value)} className="h-9" />
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <p className="truncate">Original: {tx.concept}</p>
                      <p className="truncate">{sourceText}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={tx.accountId} onChange={(event) => void updateAccount(tx.id, event.target.value)} disabled={savingId === tx.id} className="h-9 min-w-40">
                      {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={tx.categoryId ?? ""} onChange={(event) => updateCategory(tx.id, event.target.value)} disabled={savingId === tx.id} className="h-9 min-w-44">
                      <option value="">Sin categoría</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      <option value="__new">+ Nueva categoría</option>
                    </Select>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums"><span className={tx.amount >= 0 ? "text-success" : "text-danger"}>{formatCurrency(tx.amount)}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground tabular-nums">{tx.balance === null ? "-" : formatCurrency(tx.balance)}</td>
                  <td className="whitespace-nowrap px-4 py-3"><Badge tone={typeBadge.tone}>{typeBadge.label}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-40 flex-col items-start gap-2">
                      <Badge tone={planningTone(tx)}>{planningLabel(tx)}</Badge>
                      {tx.type === "EXPENSE" && !tx.isInternalTransfer ? (
                        <Select value={tx.isFixedExpense ? "fixed" : "variable"} onChange={(event) => void updateExpenseKind(tx.id, event.target.value)} disabled={savingId === tx.id} className="h-8 min-w-32 text-xs">
                          <option value="variable">Variable</option>
                          <option value="fixed">Fijo</option>
                        </Select>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" className="max-w-44 truncate rounded-md border border-border px-2 py-1 text-left text-xs text-card-foreground transition hover:bg-muted" title={goalsTitle(tx) || "Sin objetivo"} onClick={() => openPlanningAssociation(tx)} disabled={savingId === tx.id}>
                      {goalsLabel(tx)}
                    </button>
                    {tx.isInternalTransfer && tx.planningGoals.some((item) => !item.includeInternalTransfer) ? <p className="mt-1 text-xs text-warning">No cuenta salvo confirmación.</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right"><ActionMenu tx={tx} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 lg:hidden">
        {filtered.map((tx) => {
          const typeBadge = movementType(tx);
          const sourceText = tx.importHistory ? "Importado desde " + tx.importHistory.fileName : "Manual";
          return (
            <article key={tx.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{formatDate(tx.date)} - {tx.account?.name ?? "Cuenta"}</p>
                  <Input defaultValue={tx.cleanDescription ?? tx.concept} onBlur={(event) => void updateCleanDescription(tx.id, event.target.value)} className="mt-2 h-9" />
                  <p className="mt-1 truncate text-xs text-muted-foreground">Original: {tx.concept}</p>
                </div>
                <div className="text-right">
                  <p className={(tx.amount >= 0 ? "text-success" : "text-danger") + " whitespace-nowrap font-semibold tabular-nums"}>{formatCurrency(tx.amount)}</p>
                  <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">Saldo: {tx.balance === null ? "-" : formatCurrency(tx.balance)}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Select value={tx.accountId} onChange={(event) => void updateAccount(tx.id, event.target.value)} disabled={savingId === tx.id} className="h-9">
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </Select>
                <Select value={tx.categoryId ?? ""} onChange={(event) => updateCategory(tx.id, event.target.value)} disabled={savingId === tx.id} className="h-9">
                  <option value="">Sin categoría</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  <option value="__new">+ Nueva categoría</option>
                </Select>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={typeBadge.tone}>{typeBadge.label}</Badge>
                <Badge tone={planningTone(tx)}>{planningLabel(tx)}</Badge>
                <button type="button" className="max-w-full truncate rounded-md border border-border px-2 py-1 text-left text-xs text-card-foreground" title={goalsTitle(tx) || "Sin objetivo"} onClick={() => openPlanningAssociation(tx)} disabled={savingId === tx.id}>
                  {goalsLabel(tx)}
                </button>
              </div>

              {tx.type === "EXPENSE" && !tx.isInternalTransfer ? (
                <div className="mt-3">
                  <Select value={tx.isFixedExpense ? "fixed" : "variable"} onChange={(event) => void updateExpenseKind(tx.id, event.target.value)} disabled={savingId === tx.id} className="h-9">
                    <option value="variable">Gasto variable</option>
                    <option value="fixed">Gasto fijo</option>
                  </Select>
                </div>
              ) : null}

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                <p className="min-w-0 truncate text-xs text-muted-foreground">{sourceText}</p>
                <ActionMenu tx={tx} />
              </div>
            </article>
          );
        })}
      </div>

      {quickCategory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="quick-category-title">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="quick-category-title" className="text-base font-semibold text-card-foreground">Nueva categoría</h3>
              <Button type="button" variant="ghost" size="icon" onClick={() => setQuickCategory(null)} title="Cerrar"><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-4 space-y-3">
              <Input autoFocus placeholder="Nombre" value={quickCategory.name} onChange={(event) => setQuickCategory({ ...quickCategory, name: event.target.value, error: "" })} />
              <Select value={quickCategory.type} onChange={(event) => setQuickCategory({ ...quickCategory, type: event.target.value as CategoryType })}>
                {Object.entries(categoryTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Input type="color" value={quickCategory.color} onChange={(event) => setQuickCategory({ ...quickCategory, color: event.target.value })} aria-label="Color" />
              {quickCategory.error ? <p className="text-sm text-danger">{quickCategory.error}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setQuickCategory(null)}>Cancelar</Button>
              <Button type="button" onClick={() => void createQuickCategory()} disabled={savingId === quickCategory.transactionId}>Crear y asignar</Button>
            </div>
          </div>
        </div>
      ) : null}

      {planningAssociation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="planning-association-title">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="planning-association-title" className="text-base font-semibold text-card-foreground">Asociar a objetivo</h3>
              <Button type="button" variant="ghost" size="icon" onClick={() => setPlanningAssociation(null)} title="Cerrar"><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-4 space-y-4">
              {planningSource ? (
                <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <p className="font-medium text-card-foreground">{formatCurrency(planningSource.amount)} - {planningSource.cleanDescription ?? planningSource.concept}</p>
                  <p>{formatDate(planningSource.date)} - {planningSource.account?.name ?? "Cuenta"}</p>
                </div>
              ) : null}
              {planningGoals.length === 0 ? <p className="text-sm text-muted-foreground">No tienes objetivos activos. Crea uno en Planificación para poder asociarlo.</p> : null}
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {planningGoals.map((goal) => (
                  <label key={goal.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: goal.color ?? "#14b8a6" }} />
                      <span className="truncate text-card-foreground">{goal.name}</span>
                      {goal.status !== "ACTIVE" ? <span className="text-xs text-muted-foreground">{goal.status === "PAUSED" ? "Pausado" : "Completado"}</span> : null}
                    </span>
                    <input type="checkbox" checked={planningAssociation.selectedGoalIds.includes(goal.id)} onChange={() => setPlanningAssociation({ ...planningAssociation, selectedGoalIds: toggleId(planningAssociation.selectedGoalIds, goal.id), error: "" })} />
                  </label>
                ))}
              </div>
              {planningSource?.isInternalTransfer ? (
                <label className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground">
                  <input type="checkbox" checked={planningAssociation.includeInternalTransfer} onChange={(event) => setPlanningAssociation({ ...planningAssociation, includeInternalTransfer: event.target.checked })} />
                  <span>Confirmo que quiero que esta transferencia interna cuente en el cálculo del objetivo seleccionado.</span>
                </label>
              ) : null}
              {planningAssociation.error ? <p className="text-sm text-danger">{planningAssociation.error}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPlanningAssociation(null)}>Cancelar</Button>
              <Button type="button" onClick={() => void savePlanningAssociation()} disabled={savingId === planningAssociation.transactionId}>Guardar objetivos</Button>
            </div>
          </div>
        </div>
      ) : null}

      {reimbursement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reimbursement-title">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="reimbursement-title" className="text-base font-semibold text-card-foreground">Marcar como reembolso</h3>
              <Button type="button" variant="ghost" size="icon" onClick={() => setReimbursement(null)} title="Cerrar"><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-4 space-y-4">
              {reimbursementSource ? (
                <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <p className="font-medium text-card-foreground">{formatCurrency(reimbursementSource.amount)} - {reimbursementSource.cleanDescription ?? reimbursementSource.concept}</p>
                  <p>{formatDate(reimbursementSource.date)} - {reimbursementSource.account?.name ?? "Cuenta"}</p>
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">Selecciona uno o varios gastos a los que corresponde este ingreso. Si no seleccionas ninguno, se quitará la marca de reembolso.</p>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {reimbursementCandidates.length === 0 ? <p className="text-sm text-muted-foreground">No hay gastos candidatos visibles.</p> : null}
                {reimbursementCandidates.map((expense) => (
                  <label key={expense.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate text-card-foreground">{expense.cleanDescription ?? expense.concept}</span>
                      <span className="block text-xs text-muted-foreground">{formatDate(expense.date)} · {expense.account?.name ?? "Cuenta"} · {formatCurrency(expense.amount)}</span>
                    </span>
                    <input type="checkbox" checked={reimbursement.selectedExpenseIds.includes(expense.id)} onChange={() => setReimbursement({ ...reimbursement, selectedExpenseIds: toggleId(reimbursement.selectedExpenseIds, expense.id), error: "" })} />
                  </label>
                ))}
              </div>
              {reimbursement.error ? <p className="text-sm text-danger">{reimbursement.error}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setReimbursement(null)}>Cancelar</Button>
              <Button type="button" onClick={() => void saveReimbursement()} disabled={savingId === reimbursement.transactionId}>Guardar reembolso</Button>
            </div>
          </div>
        </div>
      ) : null}
      {internalTransfer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="internal-transfer-title">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="internal-transfer-title" className="text-base font-semibold text-card-foreground">Transferencia interna</h3>
              <Button type="button" variant="ghost" size="icon" onClick={() => setInternalTransfer(null)} title="Cerrar"><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">Elige la otra cuenta propia. Si ves el movimiento contrario, vincúlalo para que ambos queden unidos.</p>
              {internalTransferSource ? (
                <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <p className="font-medium text-card-foreground">{formatCurrency(internalTransferSource.amount)} - {internalTransferSource.concept}</p>
                  <p>{formatDate(internalTransferSource.date)} - {internalTransferSource.account?.name ?? "Cuenta"}</p>
                </div>
              ) : null}
              <Select value={internalTransfer.counterAccountId} onChange={(event) => { setCounterpartSearch(""); setInternalTransfer({ ...internalTransfer, counterAccountId: event.target.value, counterpartTransactionId: "", error: "" }); }}>
                <option value="">Seleccionar cuenta origen/destino</option>
                {accounts.filter((account) => account.id !== internalTransferSource?.accountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </Select>
              <Input value={counterpartSearch} onChange={(event) => setCounterpartSearch(event.target.value)} placeholder="Buscar contrapartida por concepto, fecha o importe" disabled={!internalTransfer.counterAccountId} />
              <Select value={internalTransfer.counterpartTransactionId} onChange={(event) => setInternalTransfer({ ...internalTransfer, counterpartTransactionId: event.target.value, error: "" })} disabled={!internalTransfer.counterAccountId || counterpartOptions.length === 0}>
                <option value="">Sin contrapartida exacta</option>
                {counterpartOptions.map((tx) => <option key={tx.id} value={tx.id}>{formatDate(tx.date)} - {formatCurrency(tx.amount)} - {tx.concept.slice(0, 80)}</option>)}
              </Select>
              {counterpartOptions.length === 0 && internalTransfer.counterAccountId ? <p className="text-xs text-muted-foreground">No he encontrado coincidencias cercanas en esa cuenta. Puedes buscar manualmente o marcarla igualmente sin contrapartida.</p> : null}
              {internalTransfer.error ? <p className="text-sm text-danger">{internalTransfer.error}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setInternalTransfer(null)}>Cancelar</Button>
              <Button type="button" onClick={() => void saveInternalTransfer()} disabled={savingId === internalTransfer.transactionId}>Guardar</Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}