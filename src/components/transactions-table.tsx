"use client";

import { Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";

type Category = {
  id: string;
  name: string;
  color: string;
};

type TransactionRow = {
  id: string;
  date: string;
  concept: string;
  amount: number;
  balance: number | null;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  categoryId: string | null;
  category: Category | null;
};

export function TransactionsTable({
  initialTransactions,
  categories
}: {
  initialTransactions: TransactionRow[];
  categories: Category[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return transactions;
    }

    return transactions.filter((tx) =>
      [tx.concept, tx.category?.name, tx.type].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [query, transactions]);

  async function updateCategory(id: string, categoryId: string) {
    setSavingId(id);
    const response = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: categoryId || null })
    });
    setSavingId(null);

    if (!response.ok) {
      return;
    }

    const category = categories.find((item) => item.id === categoryId) ?? null;
    setTransactions((current) =>
      current.map((tx) => (tx.id === id ? { ...tx, categoryId: category?.id ?? null, category } : tx))
    );
  }

  async function remove(id: string) {
    const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (response.ok) {
      setTransactions((current) => current.filter((tx) => tx.id !== id));
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-card-foreground">Movimientos</h2>
          <p className="text-sm text-muted-foreground">{transactions.length} transacciones cargadas</p>
        </div>
        <label className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar"
            className="pl-9"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Concepto</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 text-right font-medium">Importe</th>
              <th className="px-4 py-3 text-right font-medium">Saldo</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(tx.date)}</td>
                <td className="max-w-xs px-4 py-3">
                  <p className="truncate font-medium text-card-foreground">{tx.concept}</p>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={tx.categoryId ?? ""}
                    onChange={(event) => void updateCategory(tx.id, event.target.value)}
                    disabled={savingId === tx.id}
                    className="h-9 min-w-44"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                  <span className={tx.amount >= 0 ? "text-success" : "text-danger"}>
                    {formatCurrency(tx.amount)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                  {tx.balance === null ? "-" : formatCurrency(tx.balance)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={tx.type === "INCOME" ? "success" : tx.type === "EXPENSE" ? "danger" : "neutral"}>
                    {tx.type === "INCOME" ? "Ingreso" : tx.type === "EXPENSE" ? "Gasto" : "Transferencia"}
                  </Badge>
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
