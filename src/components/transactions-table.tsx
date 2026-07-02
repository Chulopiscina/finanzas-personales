"use client";

import { Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";

type Category = { id: string; name: string; color: string };
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

  async function updateCategory(id: string, categoryId: string) {
    let nextCategoryId = categoryId;
    if (nextCategoryId === "__new") {
      const name = window.prompt("Nombre de la nueva categoría");
      if (!name?.trim()) return;
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type: "EXPENSE" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.category) return;
      setCategories((current) => [...current, payload.category]);
      nextCategoryId = payload.category.id;
    }

    const updated = await patchTransaction(id, { categoryId: nextCategoryId || null });
    if (!updated) return;
    const category = categories.find((item) => item.id === nextCategoryId) ?? updated.category ?? null;
    setTransactions((current) =>
      current.map((tx) => (tx.id === id ? { ...tx, categoryId: category?.id ?? null, category } : tx))
    );
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
                  <Select value={tx.categoryId ?? ""} onChange={(event) => void updateCategory(tx.id, event.target.value)} disabled={savingId === tx.id} className="h-9 min-w-44">
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
                  <Badge tone={tx.type === "INCOME" ? "success" : tx.type === "EXPENSE" ? "danger" : "neutral"}>
                    {tx.type === "INCOME" ? "Ingreso" : tx.type === "EXPENSE" ? "Gasto" : "Transferencia"}
                  </Badge>
                </td>
                <td className="max-w-xs px-4 py-3 text-muted-foreground">
                  {tx.importHistory ? `Importado desde ${tx.importHistory.fileName}` : "Manual"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button type="button" variant="ghost" size="icon" onClick={() => void remove(tx.id)} title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}