"use client";
import { request } from "@/lib/client-request";

import { Archive, Pencil, Plus, Save, X } from "lucide-react";
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

type CategoryForm = {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
};

const categoryTypeLabels: Record<CategoryType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  SAVINGS: "Ahorro",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

const emptyForm: CategoryForm = {
  name: "",
  type: "EXPENSE",
  color: "#94a3b8",
  icon: "circle-dot",
};

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: CategoryRow[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(emptyForm);
  const [message, setMessage] = useState("");

  async function createCategory() {
    setMessage("");
    const response = await request("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo crear la categoría.");
      return;
    }
    setCategories((current) =>
      current.some((item) => item.id === payload.category.id)
        ? current
        : [...current, { ...payload.category, _count: { transactions: 0 } }],
    );
    setForm(emptyForm);
  }

  function startEditing(category: CategoryRow) {
    if (!category.userId) {
      setMessage("Las categorías base no se pueden editar desde aquí.");
      return;
    }
    setMessage("");
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
    });
  }

  async function saveCategory(category: CategoryRow) {
    setMessage("");
    const response = await request(`/api/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo editar la categoría.");
      return;
    }
    setCategories((current) =>
      current.map((item) =>
        item.id === category.id ? { ...item, ...payload.category } : item,
      ),
    );
    setEditingId(null);
  }

  async function archiveCategory(category: CategoryRow) {
    if (!category.userId) {
      setMessage("Las categorías base no se pueden archivar desde aquí.");
      return;
    }
    const response = await request(`/api/categories/${category.id}`, {
      method: "DELETE",
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo archivar la categoría.");
      return;
    }
    setCategories((current) =>
      current.map((item) =>
        item.id === category.id ? { ...item, ...payload.category } : item,
      ),
    );
    if (editingId === category.id) setEditingId(null);
  }

  return (
    <div className="space-y-7">
      <details className="border-b border-border pb-5">
        <summary className="w-fit cursor-pointer text-sm font-medium text-accent">
          Nueva categoría
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_70px_1fr_auto]">
          <Input
            aria-label="Nombre de categoría"
            placeholder="Nombre"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Select
            aria-label="Tipo de categoría"
            value={form.type}
            onChange={(event) =>
              setForm({ ...form, type: event.target.value as CategoryType })
            }
          >
            {Object.entries(categoryTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Color de categoría"
            type="color"
            value={form.color}
            onChange={(event) =>
              setForm({ ...form, color: event.target.value })
            }
          />
          <Input
            aria-label="Icono de categoría"
            placeholder="Icono"
            value={form.icon}
            onChange={(event) => setForm({ ...form, icon: event.target.value })}
          />
          <Button onClick={() => void createCategory()}>
            <Plus className="h-4 w-4" />
            Crear
          </Button>
        </div>
      </details>
      {message ? <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{message}</p> : null}
      <section aria-label="Tus categorías">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Categorías</h2>
          <p className="text-xs text-muted-foreground">
            {categories.length} categorías
          </p>
        </div>
        {!categories.length ? (
          <p className="empty-state">Todavía no tienes categorías.</p>
        ) : null}
        <div className="grid items-start gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {categories.map((category) => (
            <article
              key={category.id}
              className={
                "surface min-w-0 p-4 " +
                (category.isArchived ? "opacity-60" : "")
              }
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: category.color }}
                />
                <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
                  {category.name}
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  {categoryTypeLabels[category.type]}
                </span>
              </div>
              <div className="mt-3 flex justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{category._count.transactions} movimientos</span>
                <span>
                  {category.isArchived
                    ? "Archivada"
                    : category.userId
                      ? "Personal"
                      : "Categoría base"}
                </span>
              </div>
              {editingId === category.id ? (
                <div className="mt-4 grid gap-3">
                  <Input
                    aria-label="Editar nombre de categoría"
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm({ ...editForm, name: event.target.value })
                    }
                  />
                  <Select
                    aria-label="Editar tipo de categoría"
                    value={editForm.type}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        type: event.target.value as CategoryType,
                      })
                    }
                  >
                    {Object.entries(categoryTypeLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </Select>
                  <div className="grid grid-cols-[60px_1fr] gap-3">
                    <Input
                      aria-label="Editar color de categoría"
                      type="color"
                      value={editForm.color}
                      onChange={(event) =>
                        setEditForm({ ...editForm, color: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Editar icono de categoría"
                      value={editForm.icon}
                      onChange={(event) =>
                        setEditForm({ ...editForm, icon: event.target.value })
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void saveCategory(category)}
                    >
                      <Save className="h-3.5 w-3.5" />
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2 border-t border-border pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(category)}
                    disabled={!category.userId}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void archiveCategory(category)}
                    disabled={!category.userId || category.isArchived}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archivar
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
