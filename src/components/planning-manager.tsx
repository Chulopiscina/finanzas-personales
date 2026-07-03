"use client";

import { Archive, CheckCircle2, PauseCircle, PlayCircle, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";

type GoalType = "FIXED_EXPENSE" | "VARIABLE_EXPENSE" | "SAVINGS" | "INVESTMENT" | "DEBT" | "OTHER";
type GoalPeriod = "MONTHLY" | "ANNUAL" | "CUSTOM";
type GoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

type AccountOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; color: string };

type GoalMovement = {
  id: string;
  date: string;
  concept: string;
  amount: number;
  type: TransactionType;
  accountName: string | null;
  categoryName: string | null;
  source: "automatic" | "manual" | "both";
  isManual: boolean;
  isAutomatic: boolean;
  isInternalTransfer: boolean;
  includeInternalTransfer: boolean;
  countsInProgress: boolean;
};

type PlanningGoalRow = {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  actualAmount: number;
  difference: number;
  progressPercent: number;
  period: GoalPeriod;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  accountId: string;
  accountName: string | null;
  categoryIds: string[];
  categoryNames: string[];
  automaticMovementCount: number;
  manualMovementCount: number;
  movements: GoalMovement[];
  color: string;
  icon: string;
  status: GoalStatus;
  showInDashboard: boolean;
  hasData: boolean;
  tone: "success" | "warning" | "danger" | "neutral";
};

type GoalForm = {
  name: string;
  type: GoalType;
  targetAmount: string;
  period: GoalPeriod;
  periodStart: string;
  periodEnd: string;
  accountId: string;
  categoryIds: string[];
  color: string;
  icon: string;
  status: GoalStatus;
  showInDashboard: boolean;
};

const typeLabels: Record<GoalType, string> = {
  FIXED_EXPENSE: "Gasto fijo",
  VARIABLE_EXPENSE: "Gasto variable",
  SAVINGS: "Ahorro",
  INVESTMENT: "Inversión",
  DEBT: "Deuda",
  OTHER: "Otro"
};

const periodLabels: Record<GoalPeriod, string> = {
  MONTHLY: "Mensual",
  ANNUAL: "Anual",
  CUSTOM: "Personalizado"
};

const statusLabels: Record<GoalStatus, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado"
};

const movementSourceLabels: Record<GoalMovement["source"], string> = {
  automatic: "Por categoría",
  manual: "Manual",
  both: "Categoría + manual"
};

const emptyForm: GoalForm = {
  name: "",
  type: "VARIABLE_EXPENSE",
  targetAmount: "0",
  period: "MONTHLY",
  periodStart: "",
  periodEnd: "",
  accountId: "",
  categoryIds: [],
  color: "#14b8a6",
  icon: "target",
  status: "ACTIVE",
  showInDashboard: true
};

function toForm(goal: PlanningGoalRow): GoalForm {
  return {
    name: goal.name,
    type: goal.type,
    targetAmount: String(goal.targetAmount),
    period: goal.period,
    periodStart: goal.periodStart,
    periodEnd: goal.periodEnd,
    accountId: goal.accountId,
    categoryIds: goal.categoryIds,
    color: goal.color,
    icon: goal.icon,
    status: goal.status,
    showInDashboard: goal.showInDashboard
  };
}

function progressWidth(percent: number) {
  return `${Math.max(0, Math.min(100, percent))}%`;
}

function categoryToggle(current: string[], id: string) {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

function FormFields({ form, setForm, accounts, categories }: { form: GoalForm; setForm: (form: GoalForm) => void; accounts: AccountOption[]; categories: CategoryOption[] }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <Input placeholder="Nombre del objetivo" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as GoalType })}>
          {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Input type="number" min="0" step="0.01" value={form.targetAmount} onChange={(event) => setForm({ ...form, targetAmount: event.target.value })} aria-label="Importe objetivo" />
        <Select value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value as GoalPeriod })}>
          {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>
      {form.period === "CUSTOM" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Input type="date" value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} aria-label="Inicio" />
          <Input type="date" value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} aria-label="Fin" />
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-[1fr_120px_120px_1fr]">
        <Select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
          <option value="">Todas las cuentas</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </Select>
        <Input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} aria-label="Color" />
        <Input placeholder="Icono" value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} />
        <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground">
          <input type="checkbox" checked={form.showInDashboard} onChange={(event) => setForm({ ...form, showInDashboard: event.target.checked })} />
          Mostrar en dashboard
        </label>
      </div>
      <div className="rounded-md border border-border bg-muted/40 p-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">Categorías asociadas</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button key={category.id} type="button" onClick={() => setForm({ ...form, categoryIds: categoryToggle(form.categoryIds, category.id) })} className={`rounded-md border px-2 py-1 text-xs transition ${form.categoryIds.includes(category.id) ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
              {category.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlanningManager({ initialGoals, accounts, categories }: { initialGoals: PlanningGoalRow[]; accounts: AccountOption[]; categories: CategoryOption[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [form, setForm] = useState<GoalForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GoalForm>(emptyForm);
  const [message, setMessage] = useState("");

  function refresh() {
    window.location.reload();
  }

  async function createGoal() {
    setMessage("");
    const response = await fetch("/api/planning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, targetAmount: Number(form.targetAmount || 0), accountId: form.accountId || null })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo crear el objetivo.");
      return;
    }
    refresh();
  }

  async function updateGoal(id: string, payload: Partial<GoalForm>) {
    setMessage("");
    const body = { ...payload, targetAmount: payload.targetAmount === undefined ? undefined : Number(payload.targetAmount || 0), accountId: payload.accountId === "" ? null : payload.accountId };
    const response = await fetch(`/api/planning/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar el objetivo.");
      return;
    }
    refresh();
  }

  async function archiveGoal(id: string) {
    const confirmed = window.confirm("¿Archivar este objetivo? Dejará de aparecer en dashboard, pero podrás reactivarlo más adelante.");
    if (!confirmed) return;
    await updateGoal(id, { status: "ARCHIVED", showInDashboard: false });
  }

  async function deleteGoal(goal: PlanningGoalRow) {
    const warning = goal.movements.length > 0
      ? "Este objetivo tiene movimientos asociados o detectados. Esta acción eliminará el objetivo, pero no eliminará los movimientos asociados."
      : "Esta acción eliminará el objetivo, pero no eliminará ningún movimiento.";
    const confirmed = window.confirm(`${warning}\n\n¿Eliminar definitivamente este objetivo?`);
    if (!confirmed) return;

    const response = await fetch(`/api/planning/${goal.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo eliminar el objetivo.");
      return;
    }
    setGoals((current) => current.filter((item) => item.id !== goal.id));
  }

  async function removeManualMovement(goalId: string, transactionId: string) {
    const confirmed = window.confirm("¿Quitar este movimiento del objetivo? No se eliminará el movimiento.");
    if (!confirmed) return;
    const response = await fetch(`/api/planning/${goalId}/transactions/${transactionId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo quitar el movimiento del objetivo.");
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-card-foreground">Crear objetivo</h2>
        <p className="mt-1 text-sm text-muted-foreground">Define límites o metas y decide si aparecen en el dashboard.</p>
        <div className="mt-4"><FormFields form={form} setForm={setForm} accounts={accounts} categories={categories} /></div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={() => void createGoal()}><Plus className="h-4 w-4" /> Crear objetivo</Button>
          {message ? <p className="text-sm text-danger">{message}</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5">
          <h2 className="text-base font-semibold text-card-foreground">Tus objetivos</h2>
          <p className="text-sm text-muted-foreground">El progreso combina categorías asociadas y movimientos añadidos manualmente, sin duplicarlos.</p>
        </div>
        {goals.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Aún no hay objetivos. Crea uno para empezar a planificar.</p>
        ) : (
          <div className="divide-y divide-border">
            {goals.map((goal) => {
              const isEditing = editingId === goal.id;
              return (
                <article key={goal.id} className="p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <FormFields form={editForm} setForm={setEditForm} accounts={accounts} categories={categories} />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => void updateGoal(goal.id, editForm)}><Save className="h-4 w-4" /> Guardar</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="grid gap-4 lg:grid-cols-[1fr_280px] lg:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: goal.color }} />
                            <h3 className="font-semibold text-card-foreground">{goal.name}</h3>
                            <Badge tone={goal.tone}>{statusLabels[goal.status]}</Badge>
                            {goal.showInDashboard ? <Badge>Dashboard</Badge> : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {typeLabels[goal.type]} - {periodLabels[goal.period]} - {goal.periodLabel}{goal.accountName ? ` - ${goal.accountName}` : ""}
                          </p>
                          {goal.categoryNames.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">Categorías: {goal.categoryNames.join(", ")}</p> : null}
                          {!goal.hasData ? <p className="mt-2 text-xs text-warning">No hay suficientes movimientos en este periodo para calcular una tendencia fiable.</p> : null}
                          <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: progressWidth(goal.progressPercent), backgroundColor: goal.color }} /></div>
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div className="rounded-md bg-muted/50 p-2"><p className="text-xs text-muted-foreground">Actual</p><p className="font-medium text-card-foreground">{formatCurrency(goal.actualAmount)}</p></div>
                            <div className="rounded-md bg-muted/50 p-2"><p className="text-xs text-muted-foreground">Objetivo</p><p className="font-medium text-card-foreground">{formatCurrency(goal.targetAmount)}</p></div>
                            <div className="rounded-md bg-muted/50 p-2"><p className="text-xs text-muted-foreground">Diferencia</p><p className="font-medium text-card-foreground">{formatCurrency(goal.difference)}</p></div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={() => { setEditingId(goal.id); setEditForm(toForm(goal)); }}>Editar</Button>
                            {goal.status === "ARCHIVED" ? (
                              <Button type="button" variant="secondary" size="sm" onClick={() => void updateGoal(goal.id, { status: "ACTIVE" })}><RotateCcw className="h-4 w-4" /> Reactivar</Button>
                            ) : (
                              <>
                                <Button type="button" variant="secondary" size="sm" onClick={() => void updateGoal(goal.id, { status: goal.status === "PAUSED" ? "ACTIVE" : "PAUSED" })}>{goal.status === "PAUSED" ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}{goal.status === "PAUSED" ? "Activar" : "Pausar"}</Button>
                                <Button type="button" variant="secondary" size="sm" onClick={() => void updateGoal(goal.id, { status: "COMPLETED" })}><CheckCircle2 className="h-4 w-4" /> Completar</Button>
                                <Button type="button" variant="danger" size="sm" onClick={() => void archiveGoal(goal.id)}><Archive className="h-4 w-4" /> Archivar</Button>
                              </>
                            )}
                            <Button type="button" variant="danger" size="sm" onClick={() => void deleteGoal(goal)}><Trash2 className="h-4 w-4" /> Eliminar</Button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-muted/20 p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-card-foreground">Movimientos asociados</h4>
                            <p className="text-xs text-muted-foreground">{goal.automaticMovementCount} por categoría · {goal.manualMovementCount} manuales</p>
                          </div>
                        </div>
                        {goal.movements.length === 0 ? (
                          <p className="mt-3 text-sm text-muted-foreground">No hay movimientos asociados en este periodo.</p>
                        ) : (
                          <div className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border">
                            {goal.movements.slice(0, 12).map((movement) => (
                              <div key={movement.id} className="grid gap-3 bg-card px-3 py-2 text-sm md:grid-cols-[110px_1fr_130px_160px_auto] md:items-center">
                                <span className="text-muted-foreground">{formatDate(movement.date)}</span>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-card-foreground">{movement.concept}</p>
                                  <p className="truncate text-xs text-muted-foreground">{movement.accountName ?? "Cuenta"}{movement.categoryName ? ` · ${movement.categoryName}` : ""}</p>
                                </div>
                                <span className={movement.amount >= 0 ? "font-medium text-success" : "font-medium text-danger"}>{formatCurrency(movement.amount)}</span>
                                <div className="flex flex-wrap gap-1">
                                  <Badge tone={movement.source === "manual" ? "neutral" : "success"}>{movementSourceLabels[movement.source]}</Badge>
                                  {!movement.countsInProgress ? <Badge tone="warning">No cuenta</Badge> : null}
                                </div>
                                <div className="text-right">
                                  {movement.isManual ? (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => void removeManualMovement(goal.id, movement.id)}>Quitar manual</Button>
                                  ) : <span className="text-xs text-muted-foreground">Automático</span>}
                                </div>
                              </div>
                            ))}
                            {goal.movements.length > 12 ? <p className="bg-card px-3 py-2 text-xs text-muted-foreground">Mostrando 12 de {goal.movements.length} movimientos.</p> : null}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}