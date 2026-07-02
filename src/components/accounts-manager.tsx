"use client";

import { Archive, Pencil, Plus, RotateCcw, Save, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

type AccountType = "BANK" | "SAVINGS" | "CARD" | "CASH" | "INVESTMENT" | "DEBT" | "OTHER";

type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
  _count: { transactions: number; imports: number };
};

type AccountForm = {
  name: string;
  type: AccountType;
  initialBalance: string;
  currency: string;
  color: string;
};

const accountTypeLabels: Record<AccountType, string> = {
  BANK: "Banco",
  SAVINGS: "Ahorro",
  CARD: "Tarjeta",
  CASH: "Efectivo",
  INVESTMENT: "Inversión",
  DEBT: "Deuda",
  OTHER: "Otro"
};

const emptyForm: AccountForm = { name: "", type: "BANK", initialBalance: "0", currency: "EUR", color: "#14b8a6" };

function money(value: number) {
  return formatCurrency(Number.isFinite(value) ? value : 0);
}

export function AccountsManager({ initialAccounts }: { initialAccounts: AccountRow[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AccountForm>(emptyForm);
  const [message, setMessage] = useState("");

  async function createAccount() {
    setMessage("");
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, initialBalance: Number(form.initialBalance || 0) })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo crear la cuenta.");
      return;
    }
    const initialBalance = Number(form.initialBalance || 0);
    setAccounts((current) => [
      ...current,
      { ...payload.account, initialBalance, currentBalance: initialBalance, _count: { transactions: 0, imports: 0 } }
    ]);
    setForm(emptyForm);
  }

  function startEditing(account: AccountRow) {
    setMessage("");
    setEditingId(account.id);
    setEditForm({
      name: account.name,
      type: account.type,
      initialBalance: String(account.initialBalance),
      currency: account.currency || "EUR",
      color: account.color ?? "#14b8a6"
    });
  }

  async function saveAccount(account: AccountRow) {
    setMessage("");
    const nextInitialBalance = Number(editForm.initialBalance || 0);
    const response = await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, initialBalance: nextInitialBalance })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo editar la cuenta.");
      return;
    }
    const balanceDelta = nextInitialBalance - account.initialBalance;
    setAccounts((current) =>
      current.map((item) =>
        item.id === account.id
          ? { ...item, ...payload.account, initialBalance: nextInitialBalance, currentBalance: item.currentBalance + balanceDelta }
          : item
      )
    );
    setEditingId(null);
  }

  async function toggleArchive(account: AccountRow) {
    setMessage("");
    const response = await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !account.isArchived })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo actualizar la cuenta.");
      return;
    }
    setAccounts((current) => current.map((item) => (item.id === account.id ? { ...item, ...payload.account } : item)));
    if (editingId === account.id) setEditingId(null);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-card-foreground">Crear cuenta</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.3fr_1fr_1fr_0.8fr_0.8fr_auto]">
          <Input placeholder="Nombre" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as AccountType })}>
            {Object.entries(accountTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input type="number" step="0.01" value={form.initialBalance} onChange={(event) => setForm({ ...form, initialBalance: event.target.value })} aria-label="Saldo inicial" />
          <Input value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} aria-label="Moneda" maxLength={3} />
          <Input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} aria-label="Color" />
          <Button type="button" onClick={() => void createAccount()}>
            <Plus className="h-4 w-4" /> Crear
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm text-danger">{message}</p> : null}
      </section>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5">
          <h2 className="text-base font-semibold text-card-foreground">Tus cuentas</h2>
          <p className="text-sm text-muted-foreground">Las cuentas archivadas se ocultan de los selectores principales.</p>
        </div>
        {accounts.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No hay cuentas todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Cuenta</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo inicial</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo actual</th>
                  <th className="px-4 py-3 text-right font-medium">Movimientos</th>
                  <th className="px-4 py-3 text-right font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const isEditing = editingId === account.id;
                  return (
                    <tr key={account.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="grid gap-2 md:grid-cols-[1fr_76px_64px]">
                            <Input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
                            <Input type="color" value={editForm.color} onChange={(event) => setEditForm({ ...editForm, color: event.target.value })} />
                            <Input value={editForm.currency} onChange={(event) => setEditForm({ ...editForm, currency: event.target.value.toUpperCase() })} maxLength={3} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ background: account.color ?? "#94a3b8" }} />
                            <span className="font-medium text-card-foreground">{account.name}</span>
                            <span className="text-xs text-muted-foreground">{account.currency}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {isEditing ? (
                          <Select value={editForm.type} onChange={(event) => setEditForm({ ...editForm, type: event.target.value as AccountType })}>
                            {Object.entries(accountTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </Select>
                        ) : accountTypeLabels[account.type]}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {isEditing ? (
                          <Input className="ml-auto max-w-32 text-right" type="number" step="0.01" value={editForm.initialBalance} onChange={(event) => setEditForm({ ...editForm, initialBalance: event.target.value })} />
                        ) : money(account.initialBalance)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-card-foreground">{money(account.currentBalance)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{account._count.transactions}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{account.isArchived ? "Archivada" : "Activa"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button type="button" variant="secondary" size="sm" onClick={() => void saveAccount(account)}>
                                <Save className="h-4 w-4" /> Guardar
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                <X className="h-4 w-4" /> Cancelar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button type="button" variant="secondary" size="sm" onClick={() => startEditing(account)}>
                                <Pencil className="h-4 w-4" /> Editar
                              </Button>
                              <Button type="button" variant="secondary" size="sm" onClick={() => void toggleArchive(account)}>
                                {account.isArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                {account.isArchived ? "Reactivar" : "Archivar"}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
