"use client";

import { Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";

type CategoryType = "INCOME" | "EXPENSE" | "SAVINGS" | "TRANSFER" | "OTHER";
type Category = { id: string; name: string; color: string; type?: CategoryType };
type Account = { id: string; name: string; isArchived?: boolean };
type ImportOption = { id: string; fileName: string };

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
  isInternalTransfer: boolean;
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

const categoryTypeLabels: Record<CategoryType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  SAVINGS: "Ahorro",
  TRANSFER: "Transferencia",
  OTHER: "Otro"
};

export function TransactionsTable({
  initialTransactions,
  categories: initialCategories,
  accounts,
  imports,
  initialFilters
}: {
  initialTransactions: TransactionRow[];
  categories: Category[];
  accounts: Account[];
  imports: ImportOption[];
  initialFilters: { accountId: string; categoryId: string; type: string; importId: string };
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [quickCategory, setQuickCategory] = useState<QuickCategoryState | null>(null);
  const [internalTransfer, setInternalTransfer] = useState<InternalTransferState | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchesQuery =
        !q ||
        [tx.concept, tx.cleanDescription, tx.category?.name, tx.account?.name, tx.type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      return (
        matchesQuery &&
        (!filters.accountId || tx.accountId === filters.accountId) &&
        (!filters.categoryId || tx.categoryId === filters.categoryId) &&
        (!filters.type || tx.type === filters.type) &&
        (!filters.importId || tx.importHistory?.id === filters.importId)
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


  function openInternalTransfer(tx: TransactionRow) {
    const defaultCounter = accounts.find((account) => account.id !== tx.accountId)?.id ?? "";
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
        if (tx.id === updated.id) {
          return { ...tx, ...updated };
        }

        if (internalTransfer.counterpartTransactionId && tx.id === internalTransfer.counterpartTransactionId) {
          return {
            ...tx,
            type: "TRANSFER",
            isInternalTransfer: true,
            internalTransferCounterAccountId: updated.accountId
          };
        }

        return tx;
      })
    );
    setInternalTransfer(null);
  }

  async function clearInternalTransfer(tx: TransactionRow) {
    const updated = await patchTransaction(tx.id, {
      isInternalTransfer: false,
      internalTransferCounterAccountId: null
    });
    if (!updated) return;
    setTransactions((current) => current.map((item) => (item.id === tx.id ? { ...item, ...updated } : item)));
  }
  const internalTransferSource = internalTransfer
    ? transactions.find((tx) => tx.id === internalTransfer.transactionId) ?? null
    : null;
  const counterpartOptions = internalTransferSource
    ? transactions
        .filter(
          (tx) =>
            tx.id !== internalTransferSource.id &&
            tx.accountId === internalTransfer?.counterAccountId &&
            Math.sign(tx.amount) === -Math.sign(internalTransferSource.amount)
        )
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

    const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (response.ok) setTransactions((current) => current.filter((tx) => tx.id !== id));
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Movimientos</h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} de {transactions.length} transacciones
            </p>
          </div>
          <label className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" className="pl-9" />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={filters.accountId} onChange={(event) => setFilters({ ...filters, accountId: event.target.value })}>
            <option value="">Todas las cuentas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </Select>
          <Select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}>
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
          <Select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="">Todos los tipos</option>
            <option value="INCOME">Ingreso</option>
            <option value="EXPENSE">Gasto</option>
            <option value="TRANSFER">Transferencia</option>
          </Select>
          <Select value={filters.importId} onChange={(event) => setFilters({ ...filters, importId: event.target.value })}>
            <option value="">Todos los extractos</option>
            {imports.map((item) => (
              <option key={item.id} value={item.id}>{item.fileName}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Concepto</th>
              <th className="px-4 py-3 font-medium">Cuenta</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 text-right font-medium">Importe</th>
              <th className="px-4 py-3 text-right font-medium">Saldo</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Origen</th>
              <th className="px-4 py-3 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(tx.date)}</td>
                <td className="max-w-xs px-4 py-3">
                  <Input
                    defaultValue={tx.cleanDescription ?? tx.concept}
                    onBlur={(event) => void updateCleanDescription(tx.id, event.target.value)}
                    className="h-9"
                  />
                  <p className="mt-1 truncate text-xs text-muted-foreground">Original: {tx.concept}</p>
                </td>
                <td className="px-4 py-3">
                  <Select value={tx.accountId} onChange={(event) => void updateAccount(tx.id, event.target.value)} disabled={savingId === tx.id} className="h-9 min-w-40">
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select value={tx.categoryId ?? ""} onChange={(event) => updateCategory(tx.id, event.target.value)} disabled={savingId === tx.id} className="h-9 min-w-44">
                    <option value="">Sin categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                    <option value="__new">+ Nueva categoría</option>
                  </Select>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                  <span className={tx.amount >= 0 ? "text-success" : "text-danger"}>{formatCurrency(tx.amount)}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                  {tx.balance === null ? "-" : formatCurrency(tx.balance)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={tx.isInternalTransfer ? "neutral" : tx.type === "INCOME" ? "success" : tx.type === "EXPENSE" ? "danger" : "neutral"}>
                    {tx.isInternalTransfer ? "Transferencia interna" : tx.type === "INCOME" ? "Ingreso" : tx.type === "EXPENSE" ? "Gasto" : "Transferencia"}
                  </Badge>
                </td>
                <td className="max-w-xs px-4 py-3 text-muted-foreground">
                  {tx.importHistory ? `Importado desde ${tx.importHistory.fileName}` : "Manual"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {tx.isInternalTransfer ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => void clearInternalTransfer(tx)} disabled={savingId === tx.id}>
                        Quitar interna
                      </Button>
                    ) : (
                      <Button type="button" variant="secondary" size="sm" onClick={() => openInternalTransfer(tx)} disabled={savingId === tx.id || accounts.length < 2}>
                        Marcar como interna
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={() => void remove(tx.id)} title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {quickCategory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="quick-category-title">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="quick-category-title" className="text-base font-semibold text-card-foreground">Nueva categoría</h3>
              <Button type="button" variant="ghost" size="icon" onClick={() => setQuickCategory(null)} title="Cerrar">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <Input autoFocus placeholder="Nombre" value={quickCategory.name} onChange={(event) => setQuickCategory({ ...quickCategory, name: event.target.value, error: "" })} />
              <Select value={quickCategory.type} onChange={(event) => setQuickCategory({ ...quickCategory, type: event.target.value as CategoryType })}>
                {Object.entries(categoryTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
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

      {internalTransfer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="internal-transfer-title">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="internal-transfer-title" className="text-base font-semibold text-card-foreground">Transferencia interna</h3>
              <Button type="button" variant="ghost" size="icon" onClick={() => setInternalTransfer(null)} title="Cerrar">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">Elige la otra cuenta propia. Si ves el movimiento contrario, vinculalo para que ambos queden unidos.</p>
              {internalTransferSource ? (
                <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <p className="font-medium text-card-foreground">{formatCurrency(internalTransferSource.amount)} - {internalTransferSource.concept}</p>
                  <p>{formatDate(internalTransferSource.date)} - {internalTransferSource.account?.name ?? "Cuenta"}</p>
                </div>
              ) : null}
              <Select
                value={internalTransfer.counterAccountId}
                onChange={(event) => setInternalTransfer({ ...internalTransfer, counterAccountId: event.target.value, counterpartTransactionId: "", error: "" })}
              >
                <option value="">Seleccionar cuenta origen/destino</option>
                {accounts
                  .filter((account) => account.id !== internalTransferSource?.accountId)
                  .map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
              </Select>
              <Select
                value={internalTransfer.counterpartTransactionId}
                onChange={(event) => setInternalTransfer({ ...internalTransfer, counterpartTransactionId: event.target.value, error: "" })}
                disabled={!internalTransfer.counterAccountId || counterpartOptions.length === 0}
              >
                <option value="">Sin contrapartida exacta</option>
                {counterpartOptions.map((tx) => (
                  <option key={tx.id} value={tx.id}>
                    {formatDate(tx.date)} - {formatCurrency(tx.amount)} - {tx.concept.slice(0, 80)}
                  </option>
                ))}
              </Select>
              {counterpartOptions.length === 0 && internalTransfer.counterAccountId ? (
                <p className="text-xs text-muted-foreground">No he encontrado movimientos de signo contrario en esa cuenta. Puedes marcarla igualmente.</p>
              ) : null}
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
