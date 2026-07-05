"use client";

import { Copy, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

type Block = "FIXED" | "VARIABLE" | "EXTRA" | "SAVINGS";
type Category = { id: string; name: string; color: string };
type Account = { id: string; name: string };
type BlockProgress = { limit: number; actual: number; percent: number; remaining: number };
type BudgetRow = {
  id: string;
  month: string;
  accountId: string;
  accountName: string | null;
  expectedIncome: number;
  fixedLimit: number;
  variableLimit: number;
  extraLimit: number;
  savingsGoal: number;
  categories: Array<{ block: Block; categoryId: string }>;
  progress: { fixed: BlockProgress; variable: BlockProgress; extra: BlockProgress; savings: BlockProgress; spent: number; totalLimit: number; percent: number; remaining: number };
};

type BudgetForm = {
  month: string;
  accountId: string;
  expectedIncome: string;
  fixedLimit: string;
  variableLimit: string;
  extraLimit: string;
  savingsGoal: string;
  categories: Record<Block, string[]>;
};

const blockLabels: Record<Block, string> = { FIXED: "Gastos fijos", VARIABLE: "Gastos variables", EXTRA: "Gastos extras", SAVINGS: "Ahorro" };
const emptyForm: BudgetForm = { month: new Date().toISOString().slice(0, 7), accountId: "", expectedIncome: "", fixedLimit: "", variableLimit: "", extraLimit: "", savingsGoal: "", categories: { FIXED: [], VARIABLE: [], EXTRA: [], SAVINGS: [] } };

function monthInput(value: string) { return value.slice(0, 7); }
function nextMonthInput(value: string) {
  const date = new Date(value + "-01T00:00:00.000Z");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
}
function toForm(budget: BudgetRow): BudgetForm {
  const categories: Record<Block, string[]> = { FIXED: [], VARIABLE: [], EXTRA: [], SAVINGS: [] };
  for (const item of budget.categories) categories[item.block].push(item.categoryId);
  return { month: monthInput(budget.month), accountId: budget.accountId, expectedIncome: String(budget.expectedIncome), fixedLimit: String(budget.fixedLimit), variableLimit: String(budget.variableLimit), extraLimit: String(budget.extraLimit), savingsGoal: String(budget.savingsGoal), categories };
}
function payload(form: BudgetForm) {
  return { month: form.month + "-01", accountId: form.accountId || null, expectedIncome: Number(form.expectedIncome || 0), fixedLimit: Number(form.fixedLimit || 0), variableLimit: Number(form.variableLimit || 0), extraLimit: Number(form.extraLimit || 0), savingsGoal: Number(form.savingsGoal || 0), categories: form.categories };
}
function toggleCategory(form: BudgetForm, block: Block, categoryId: string) {
  const withoutCategory = Object.fromEntries(Object.entries(form.categories).map(([key, ids]) => [key, ids.filter((id) => id !== categoryId)])) as Record<Block, string[]>;
  withoutCategory[block] = form.categories[block].includes(categoryId) ? form.categories[block].filter((id) => id !== categoryId) : [...withoutCategory[block], categoryId];
  return { ...form, categories: withoutCategory };
}
function ProgressBar({ row, tone = "orange" }: { row: BlockProgress; tone?: "orange" | "blue" }) {
  return <div className="space-y-1"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{formatCurrency(row.actual)} / {formatCurrency(row.limit)}</span><span>{row.percent} %</span></div><div className="h-2 rounded-full bg-muted"><div className={tone === "blue" ? "h-full rounded-full bg-blue-500" : "h-full rounded-full bg-orange-500"} style={{ width: Math.max(0, Math.min(100, row.percent)) + "%" }} /></div></div>;
}
function BudgetFormFields({ form, setForm, accounts, categories }: { form: BudgetForm; setForm: (form: BudgetForm) => void; accounts: Account[]; categories: Category[] }) {
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><Input type="month" value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} aria-label="Mes del presupuesto" /><Select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}><option value="">Todas las cuentas</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select><Input type="number" min="0" step="0.01" placeholder="Ingresos previstos" value={form.expectedIncome} onChange={(event) => setForm({ ...form, expectedIncome: event.target.value })} /></div><div className="grid gap-3 md:grid-cols-4"><Input type="number" min="0" step="0.01" placeholder="Tope gastos fijos" value={form.fixedLimit} onChange={(event) => setForm({ ...form, fixedLimit: event.target.value })} /><Input type="number" min="0" step="0.01" placeholder="Tope variables" value={form.variableLimit} onChange={(event) => setForm({ ...form, variableLimit: event.target.value })} /><Input type="number" min="0" step="0.01" placeholder="Tope extras" value={form.extraLimit} onChange={(event) => setForm({ ...form, extraLimit: event.target.value })} /><Input type="number" min="0" step="0.01" placeholder="Objetivo ahorro" value={form.savingsGoal} onChange={(event) => setForm({ ...form, savingsGoal: event.target.value })} /></div><div className="grid gap-3 lg:grid-cols-4">{(Object.keys(blockLabels) as Block[]).map((block) => <div key={block} className="rounded-2xl border border-border bg-muted/20 p-3"><p className="mb-2 text-sm font-medium text-card-foreground">{blockLabels[block]}</p><div className="max-h-44 space-y-2 overflow-auto pr-1">{categories.map((category) => <label key={category.id} className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={form.categories[block].includes(category.id)} onChange={() => setForm(toggleCategory(form, block, category.id))} /><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} /><span className="truncate">{category.name}</span></label>)}</div></div>)}</div></div>;
}

export function BudgetManager({ initialBudgets, accounts, categories }: { initialBudgets: BudgetRow[]; accounts: Account[]; categories: Category[] }) {
  const [budgets, setBudgets] = useState(initialBudgets);
  const [form, setForm] = useState<BudgetForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BudgetForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  async function createBudget() { setMessage(""); setSavingId("new"); const response = await fetch("/api/budgets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(form)) }); const data = await response.json().catch(() => ({})); setSavingId(null); if (!response.ok || !data.budget) return setMessage(data.error ?? "No se pudo crear el presupuesto."); window.location.reload(); }
  async function updateBudget(id: string, nextForm: BudgetForm) { setMessage(""); setSavingId(id); const response = await fetch(`/api/budgets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(nextForm)) }); const data = await response.json().catch(() => ({})); setSavingId(null); if (!response.ok || !data.budget) return setMessage(data.error ?? "No se pudo actualizar el presupuesto."); window.location.reload(); }
  async function duplicateBudget(budget: BudgetRow) { setSavingId(budget.id); const response = await fetch(`/api/budgets/${budget.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: nextMonthInput(monthInput(budget.month)) + "-01" }) }); const data = await response.json().catch(() => ({})); setSavingId(null); if (!response.ok || !data.budget) return setMessage(data.error ?? "No se pudo duplicar el presupuesto."); window.location.reload(); }
  async function deleteBudget(budget: BudgetRow) { if (!window.confirm("¿Eliminar este presupuesto? No se borrará ningún movimiento.")) return; setSavingId(budget.id); const response = await fetch(`/api/budgets/${budget.id}`, { method: "DELETE" }); setSavingId(null); if (!response.ok) { const data = await response.json().catch(() => ({})); return setMessage(data.error ?? "No se pudo eliminar el presupuesto."); } setBudgets((current) => current.filter((item) => item.id !== budget.id)); }
  return <div className="space-y-5"><section className="rounded-2xl border border-orange-500/20 bg-card p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:shadow-none"><div className="mb-4"><h2 className="text-base font-semibold text-card-foreground">Crear presupuesto</h2><p className="text-sm text-muted-foreground">Define límites mensuales y asigna categorías a cada bloque.</p></div><BudgetFormFields form={form} setForm={setForm} accounts={accounts} categories={categories} /><div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" onClick={() => void createBudget()} disabled={savingId === "new"}><Plus className="h-4 w-4" /> Crear presupuesto</Button>{message ? <p className="text-sm text-danger">{message}</p> : null}</div></section><section className="rounded-2xl border border-border bg-card shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:shadow-none"><div className="border-b border-border p-5"><h2 className="text-base font-semibold text-card-foreground">Presupuestos configurados</h2><p className="text-sm text-muted-foreground">{budgets.length} presupuestos guardados.</p></div>{budgets.length === 0 ? <div className="m-5 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">No tienes presupuestos configurados.</div> : null}<div className="divide-y divide-border">{budgets.map((budget) => { const isEditing = editingId === budget.id; return <article key={budget.id} className="p-5">{isEditing ? <div className="space-y-4"><BudgetFormFields form={editForm} setForm={setEditForm} accounts={accounts} categories={categories} /><div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => void updateBudget(budget.id, editForm)} disabled={savingId === budget.id}><Save className="h-4 w-4" /> Guardar</Button><Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="h-4 w-4" /> Cancelar</Button></div></div> : <div className="space-y-4"><div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start"><div><h3 className="font-semibold text-card-foreground">{new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(budget.month))}</h3><p className="mt-1 text-sm text-muted-foreground">{budget.accountName ?? "Todas las cuentas"} · Ingresos previstos {formatCurrency(budget.expectedIncome)}</p><p className="mt-1 text-sm text-muted-foreground">Gastado {formatCurrency(budget.progress.spent)} / {formatCurrency(budget.progress.totalLimit)} · Restante {formatCurrency(budget.progress.remaining)} · {budget.progress.percent} %</p></div><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => { setEditingId(budget.id); setEditForm(toForm(budget)); }}>Editar</Button><Button type="button" variant="secondary" size="sm" onClick={() => void duplicateBudget(budget)} disabled={savingId === budget.id}><Copy className="h-4 w-4" /> Duplicar</Button><Button type="button" variant="danger" size="sm" onClick={() => void deleteBudget(budget)} disabled={savingId === budget.id}><Trash2 className="h-4 w-4" /> Eliminar</Button></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-border bg-muted/20 p-3"><p className="mb-2 text-sm font-medium">Gastos fijos</p><ProgressBar row={budget.progress.fixed} /></div><div className="rounded-2xl border border-border bg-muted/20 p-3"><p className="mb-2 text-sm font-medium">Gastos variables</p><ProgressBar row={budget.progress.variable} /></div><div className="rounded-2xl border border-border bg-muted/20 p-3"><p className="mb-2 text-sm font-medium">Gastos extras</p><ProgressBar row={budget.progress.extra} /></div><div className="rounded-2xl border border-border bg-muted/20 p-3"><p className="mb-2 text-sm font-medium">Ahorro</p><ProgressBar row={budget.progress.savings} tone="blue" /></div></div></div>}</article>; })}</div></section></div>;
}
