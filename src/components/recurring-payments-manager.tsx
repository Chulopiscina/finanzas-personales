"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Plus, Save, X } from "lucide-react";
import { RecurringPaymentList } from "@/components/recurring-payment-list";
import { useDialogFocus } from "@/components/use-dialog-focus";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { request } from "@/lib/client-request";
import { paymentFrequencyLabels, type CalendarPayment, type PaymentFrequency } from "@/lib/recurring-calendar";

type Status = CalendarPayment["status"];
type AccountOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; color: string };
type PaymentRow = CalendarPayment & {
  projectedDate: string | null;
  daysUntil: number | null;
  accountId: string;
  categoryId: string;
  description: string;
};
type PaymentForm = {
  name: string;
  amount: string;
  nextChargeDate: string;
  frequency: PaymentFrequency;
  accountId: string;
  categoryId: string;
  description: string;
  status: Status;
};
type SavedPayment = Omit<PaymentRow, "amount" | "accountName" | "categoryName" | "accountId" | "categoryId" | "description" | "projectedDate" | "daysUntil"> & {
  amount: string | number;
  accountId: string | null;
  categoryId: string | null;
  description: string | null;
  account: AccountOption | null;
  category: CategoryOption | null;
};
const statusLabels: Record<Status, string> = { ACTIVE: "Activo", PAUSED: "Pausado", CANCELED: "Cancelado" };
const emptyForm: PaymentForm = {
  name: "", amount: "", nextChargeDate: "", frequency: "MONTHLY", accountId: "", categoryId: "", description: "", status: "ACTIVE",
};

function FormFields({ form, setForm, accounts, categories }: {
  form: PaymentForm;
  setForm: (form: PaymentForm) => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">Nombre
      <Input required maxLength={200} placeholder="Por ejemplo, seguro del coche" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
    </label>
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Importe previsto (€)
      <Input required type="number" min="0.01" step="0.01" placeholder="0,00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
    </label>
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Fecha del próximo cobro
      <Input required type="date" value={form.nextChargeDate.slice(0, 10)} onChange={(event) => setForm({ ...form, nextChargeDate: event.target.value })} />
    </label>
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Frecuencia
      <Select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as PaymentFrequency })}>
        {Object.entries(paymentFrequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
    </label>
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Estado
      <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}>
        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
    </label>
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Cuenta prevista
      <Select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
        <option value="">Sin cuenta</option>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </Select>
    </label>
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Categoría
      <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
        <option value="">Sin categoría</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </Select>
    </label>
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">Descripción opcional
      <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
    </label>
  </div>;
}

function payloadFromForm(form: PaymentForm) {
  return {
    name: form.name, amount: Number(form.amount || 0), nextChargeDate: form.nextChargeDate,
    frequency: form.frequency, accountId: form.accountId || null, categoryId: form.categoryId || null,
    description: form.description || null, status: form.status,
  };
}

export function RecurringPaymentsManager({ initialPayments, accounts, categories }: {
  initialPayments: PaymentRow[];
  accounts: AccountOption[];
  categories: CategoryOption[];
}) {
  const [payments, setPayments] = useState(initialPayments);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PaymentForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const createDetails = useRef<HTMLDetailsElement>(null);
  useDialogFocus(editingId !== null, () => { if (!savingId) setEditingId(null); });

  async function savePayment(id: string | null, next: PaymentForm | { status: Status }) {
    setMessage("");
    setSavingId(id ?? "new");
    try {
      const response = await request(id ? `/api/recurring-payments/${id}` : "/api/recurring-payments", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("name" in next ? payloadFromForm(next) : next),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.payment) {
        setMessage(payload.error ?? "No se pudo guardar el pago recurrente.");
        return;
      }
      const saved = payload.payment as SavedPayment;
      const row: PaymentRow = {
        ...saved, amount: Number(saved.amount), accountId: saved.accountId ?? "", categoryId: saved.categoryId ?? "",
        accountName: saved.account?.name ?? null, categoryName: saved.category?.name ?? null,
        description: saved.description ?? "", projectedDate: null, daysUntil: null,
      };
      setPayments((current) => id ? current.map((item) => item.id === id ? row : item) : [...current, row]);
      setEditingId(null);
      if (!id) {
        setForm(emptyForm);
        if (createDetails.current) createDetails.current.open = false;
      }
    } catch {
      setMessage("No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.");
    } finally { setSavingId(null); }
  }

  async function deletePayment(payment: PaymentRow) {
    if (!window.confirm(`¿Eliminar definitivamente ${payment.name}? Esta acción no creará ni borrará movimientos reales.`)) return;
    setMessage("");
    setSavingId(payment.id);
    try {
      const response = await request(`/api/recurring-payments/${payment.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setMessage(payload.error ?? "No se pudo eliminar el pago recurrente.");
        return;
      }
      setPayments((current) => current.filter((item) => item.id !== payment.id));
    } catch {
      setMessage("No se ha podido eliminar. Comprueba tu conexión e inténtalo de nuevo.");
    } finally { setSavingId(null); }
  }

  return <div className="mx-auto w-full max-w-4xl space-y-6">
    <details ref={createDetails} className="payment-create group">
      <summary className="ml-auto flex min-h-10 w-fit cursor-pointer list-none items-center gap-2 rounded-lg border border-accent/25 bg-accent/10 px-3 text-sm font-medium text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <Plus className="h-4 w-4" />Añadir pago recurrente
      </summary>
      <form className="mx-auto mt-5 max-w-xl space-y-4" onSubmit={(event) => { event.preventDefault(); void savePayment(null, form); }}>
        <p className="text-xs text-muted-foreground">Solo planificación. No crea gastos reales.</p>
        <FormFields form={form} setForm={setForm} accounts={accounts} categories={categories} />
        <div className="flex justify-end"><Button type="submit" disabled={savingId !== null}>
          {savingId === "new" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Crear pago
        </Button></div>
      </form>
    </details>
    {message && !editingId && <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{message}</p>}
    <RecurringPaymentList payments={payments} savingId={savingId}
      onEdit={(payment) => {
        setMessage(""); setEditingId(payment.id);
        setEditForm({ ...payment, amount: String(payment.amount), nextChargeDate: payment.nextChargeDate.slice(0, 10) });
      }}
      onStatus={(payment, status) => { void savePayment(payment.id, { status }); }}
      onDelete={(payment) => { void deletePayment(payment); }}
    />
    {editingId && <div role="dialog" aria-modal="true" aria-labelledby="edit-payment-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg border border-border bg-card p-5 shadow-xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="edit-payment-title" className="text-lg font-semibold">Editar pago recurrente</h2>
          <Button size="icon" variant="ghost" title="Cerrar edición" disabled={savingId !== null} onClick={() => setEditingId(null)}><X className="h-5 w-5" /></Button>
        </div>
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void savePayment(editingId, editForm); }}>
          <FormFields form={editForm} setForm={setEditForm} accounts={accounts} categories={categories} />
          {message && <p role="alert" className="text-sm text-danger">{message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={savingId !== null} onClick={() => setEditingId(null)}>Cancelar</Button>
            <Button type="submit" disabled={savingId !== null}>{savingId === editingId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar</Button>
          </div>
        </form>
      </div>
    </div>}
  </div>;
}
