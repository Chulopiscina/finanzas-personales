"use client";

import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type CategoryType = "INCOME" | "EXPENSE" | "SAVINGS" | "TRANSFER" | "OTHER";

type CategoryRow = {
  id: string;
  userId: string | null;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  isArchived: boolean;
  _count: { transactions: number };
};

const categoryTypeLabels: Record<CategoryType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  SAVINGS: "Ahorro",
  TRANSFER: "Transferencia",
  OTHER: "Otro"
};

export function CategoriesManager({ initialCategories }: { initialCategories: CategoryRow[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [form, setForm] = useState({ name: "", type: "EXPENSE" as CategoryType, color: "#94a3b8", icon: "circle-dot" });
  const [message, setMessage] = useState("");

  async function createCategory() {
    setMessage("");
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo crear la categoría.");
      return;
    }
    setCategories((current) => [...current, { ...payload.category, _count: { transactions: 0 } }]);
    setForm({ name: "", type: "EXPENSE", color: "#94a3b8", icon: "circle-dot" });
  }

  async function archiveCategory(category: CategoryRow) {
    if (!category.userId) {
      setMessage("Las categorías base no se pueden archivar desde aquí.");
      return;
    }
    const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo archivar la categoría.");
      return;
    }
    setCategories((current) => current.map((item) => (item.id === category.id ? { ...item, ...payload.category } : item)));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-card-foreground">Nueva categoría</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <Input placeholder="Nombre" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as CategoryType })}>
            {Object.entries(categoryTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
          <Input placeholder="Icono" value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} />
          <Button type="button" onClick={() => void createCategory()}>
            <Plus className="h-4 w-4" /> Crear
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm text-danger">{message}</p> : null}
      </section>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5">
          <h2 className="text-base font-semibold text-card-foreground">Categorías</h2>
          <p className="text-sm text-muted-foreground">Las categorías con movimientos se archivan en vez de borrarse.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Movimientos</th>
                <th className="px-4 py-3 text-right font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: category.color }} />
                      <span className="font-medium text-card-foreground">{category.name}</span>
                      {!category.userId ? <span className="text-xs text-muted-foreground">base</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{categoryTypeLabels[category.type]}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{category._count.transactions}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{category.isArchived ? "Archivada" : "Activa"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="secondary" size="sm" onClick={() => void archiveCategory(category)} disabled={!category.userId || category.isArchived}>
                      <Archive className="h-4 w-4" /> Archivar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}