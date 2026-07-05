"use client";

import { Archive, CheckCircle2, PauseCircle, PlayCircle, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";

type Frequency = "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONCE" | "OTHER";
type Status = "ACTIVE" | "PAUSED" | "CANCELED";
type AccountOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; color: string };

type PaymentRow = {
  id: string;
  name: string;
  amount: number;
  nextChargeDate: string;
  projectedDate: string | null;
  daysUntil: number | null;
  frequency: Frequency;
  accountId: string;
  accountName: string | null;
  categoryId: string;
  categoryName: string | null;
  description: string;
  status: Status;
};

type PaymentForm = {
  name: string;
  amount: string;
  nextChargeDate: string;
  frequency: Frequency;
  accountId: string;
  categoryId: string;
  description: string;
  status: Status;
};

const frequencyLabels: Record<Frequency, string> = {
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  ANNUAL: "Anual",
  ONCE: "Única vez",
  OTHER: "Otra"
};

const statusLabels: Record<Status, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  CANCELED: "Cancelado"
};

const emptyForm: PaymentForm = {
  name: "",
  amount: "",
  nextChargeDate: "",
  frequency: "MONTHLY",
  accountId: "",
  categoryId: "",
  description: "",
  status: "ACTIVE"
};

function dateInput(value: string) {
  return value ? value.slice(0, 10) : "";
}

function toForm(payment: PaymentRow): PaymentForm {
  return {
    name: payment.name,
    amount: String(payment.amount),
    nextChargeDate: dateInput(payment.nextChargeDate),
    frequency: payment.frequency,
    accountId: payment.accountId,
    categoryId: payment.categoryId,
    description: payment.description,
    status: payment.status
  };
}

function FormFields({ form, setForm, accounts, categories }: { form: PaymentForm; setForm: (form: PaymentForm) => void; accounts: AccountOption[]; categories: CategoryOption[] }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_1fr_1fr]">
        <Input placeholder="Nombre" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input type="number" min="0" step="0.01" placeholder="Importe" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        <Input type="date" value={form.nextChargeDate} onChange={(event) => setForm({ ...form, nextChargeDate: event.target.value })} aria-label="Fecha del próximo cobro" />
        <Select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as Frequency })}>
          {Object.entries(frequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
          <option value="">Cuenta opcional</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </Select>
        <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          <option value="">Categoría opcional</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </Select>
        <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>
      <Textarea placeholder="Descripción opcional" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
    </div>
  );
}

function payloadFromForm(form: PaymentForm) {
  return {
    name: form.name,
    amount: Number(form.amount || 0),
    nextChargeDate: form.nextChargeDate,
    frequency: form.frequency,
    accountId: form.accountId || null,
    categoryId: form.categoryId || null,
    description: form.description || null,
    status: form.status
  };
}

function statusTone(status: Status) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "PAUSED") return "warning" as const;
  return "neutral" as const;
}

function daysLabel(days: number | null) {
  if (days === null) return "Sin próxima fecha";
  if (days === 0) return "Hoy";
  if (days === 1) return "Falta 1 día";
  return `Faltan ${days} días`;
}

export function RecurringPaymentsManager({ initialPayments, accounts, categories }: { initialPayments: PaymentRow[]; accounts: AccountOption[]; categories: CategoryOption[] }) {
  const [payments, setPayments] = useState(initialPayments);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PaymentForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function createPayment() {
    setMessage("");
    setSavingId("new");
    const response = await fetch("/api/recurring-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromForm(form))
    });
    const payload = await response.json().catch(() => ({}));
    setSavingId(null);
    if (!response.ok || !payload.payment) {
      setMessage(payload.error ?? "No se pudo crear el pago recurrente.");
      return;
    }
    window.location.reload();
  }

  async function updatePayment(id: string, nextForm: Partial<PaymentForm> | PaymentForm) {
    setMessage("");
    setSavingId(id);
    const response = await fetch(`/api/recurring-payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify("name" in nextForm ? payloadFromForm(nextForm as PaymentForm) : nextForm)
    });
    const payload = await response.json().catch(() => ({}));
    setSavingId(null);
    if (!response.ok || !payload.payment) {
      setMessage(payload.error ?? "No se pudo actualizar el pago recurrente.");
      return;
    }
    window.location.reload();
  }

  async function deletePayment(payment: PaymentRow) {
    const confirmed = window.confirm(`¿Eliminar definitivamente ${payment.name}? Esta acción no creará ni borrará movimientos reales.`);
    if (!confirmed) return;
    setSavingId(payment.id);
    const response = await fetch(`/api/recurring-payments/${payment.id}`, { method: "DELETE" });
    setSavingId(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error ?? "No se pudo eliminar el pago recurrente.");
      return;
    }
    setPayments((current) => current.filter((item) => item.id !== payment.id));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-blue-500/20 bg-card p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-card-foreground">Añadir pago recurrente</h2>
          <p className="text-sm text-muted-foreground">Solo se usa para planificación. No crea gastos reales.</p>
        </div>
        <FormFields form={form} setForm={setForm} accounts={accounts} categories={categories} />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void createPayment()} disabled={savingId === "new"}><Plus className="h-4 w-4" /> Crear pago</Button>
          {message ? <p className="text-sm text-danger">{message}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="border-b border-border p-5">
          <h2 className="text-base font-semibold text-card-foreground">Pagos configurados</h2>
          <p className="text-sm text-muted-foreground">{payments.length} pagos recurrentes guardados.</p>
        </div>
        {payments.length === 0 ? (
          <div className="m-5 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">No tienes pagos recurrentes configurados.</div>
        ) : (
          <div className="divide-y divide-border">
            {payments.map((payment) => {
              const isEditing = editingId === payment.id;
              return (
                <article key={payment.id} className="p-5">
                  {isEditing ? (
                    <div className="space-y-4">
                      <FormFields form={editForm} setForm={setEditForm} accounts={accounts} categories={categories} />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => void updatePayment(payment.id, editForm)} disabled={savingId === payment.id}><Save className="h-4 w-4" /> Guardar</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}><X className="h-4 w-4" /> Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-card-foreground">{payment.name}</h3>
                          <Badge tone={statusTone(payment.status)}>{statusLabels[payment.status]}</Badge>
                          <Badge>{frequencyLabels[payment.frequency]}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatCurrency(payment.amount)} · {payment.projectedDate ? formatDate(payment.projectedDate) : "Sin próxima fecha"} · {daysLabel(payment.daysUntil)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {payment.accountName ?? "Sin cuenta"}{payment.categoryName ? ` · ${payment.categoryName}` : ""}{payment.description ? ` · ${payment.description}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => { setEditingId(payment.id); setEditForm(toForm(payment)); }}>Editar</Button>
                        {payment.status === "ACTIVE" ? (
                          <Button type="button" variant="secondary" size="sm" onClick={() => void updatePayment(payment.id, { status: "PAUSED" })} disabled={savingId === payment.id}><PauseCircle className="h-4 w-4" /> Pausar</Button>
                        ) : (
                          <Button type="button" variant="secondary" size="sm" onClick={() => void updatePayment(payment.id, { status: "ACTIVE" })} disabled={savingId === payment.id}><PlayCircle className="h-4 w-4" /> Reactivar</Button>
                        )}
                        {payment.status !== "CANCELED" ? <Button type="button" variant="secondary" size="sm" onClick={() => void updatePayment(payment.id, { status: "CANCELED" })} disabled={savingId === payment.id}><Archive className="h-4 w-4" /> Cancelar</Button> : null}
                        <Button type="button" variant="danger" size="sm" onClick={() => void deletePayment(payment)} disabled={savingId === payment.id}><Trash2 className="h-4 w-4" /> Eliminar</Button>
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
