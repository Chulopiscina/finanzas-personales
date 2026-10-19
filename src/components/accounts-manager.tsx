"use client";
import { request } from "@/lib/client-request";

import { Archive, Pencil, Plus, RotateCcw, Save, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";

type AccountType =
  | "BANK"
  | "SAVINGS"
  | "CARD"
  | "CASH"
  | "INVESTMENT"
  | "DEBT"
  | "OTHER";

type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currentBalance: number;
  confirmedBalance?: number | null;
  confirmedAt?: string | null;
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
  OTHER: "Otro",
};

const emptyForm: AccountForm = {
  name: "",
  type: "BANK",
  initialBalance: "0",
  currency: "EUR",
  color: "#14b8a6",
};

function money(value: number) {
  return formatCurrency(Number.isFinite(value) ? value : 0);
}

export function AccountsManager({
  initialAccounts,
}: {
  initialAccounts: AccountRow[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AccountForm>(emptyForm);
  const [message, setMessage] = useState("");

  async function createAccount() {
    setMessage("");
    const response = await request("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        initialBalance: Number(form.initialBalance || 0),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo crear la cuenta.");
      return;
    }
    const initialBalance = Number(form.initialBalance || 0);
    setAccounts((current) => [
      ...current,
      {
        ...payload.account,
        initialBalance,
        currentBalance: initialBalance,
        _count: { transactions: 0, imports: 0 },
      },
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
      color: account.color ?? "#14b8a6",
    });
  }

  async function saveAccount(account: AccountRow) {
    setMessage("");
    const nextInitialBalance = Number(editForm.initialBalance || 0);
    const response = await request(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, initialBalance: nextInitialBalance }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo editar la cuenta.");
      return;
    }
    setAccounts((current) =>
      current.map((item) =>
        item.id === account.id
          ? { ...item, ...payload.account, initialBalance: nextInitialBalance }
          : item,
      ),
    );
    setEditingId(null);
  }

  async function toggleArchive(account: AccountRow) {
    setMessage("");
    const response = await request(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !account.isArchived }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "No se pudo actualizar la cuenta.");
      return;
    }
    setAccounts((current) =>
      current.map((item) =>
        item.id === account.id ? { ...item, ...payload.account } : item,
      ),
    );
    if (editingId === account.id) setEditingId(null);
  }

  return (
    <div className="space-y-7">
      <section
        aria-label="Resumen de cuentas"
        className="flex flex-wrap gap-6 border-b border-border pb-5 text-sm"
      >
        <p>
          <strong className="text-lg font-semibold">
            {accounts.filter((account) => !account.isArchived).length}
          </strong>{" "}
          <span className="text-muted-foreground">cuentas activas</span>
        </p>
        <p>
          <strong className="text-lg font-semibold">
            {accounts.filter((account) => account.isArchived).length}
          </strong>{" "}
          <span className="text-muted-foreground">archivadas</span>
        </p>
      </section>
      <details className="border-b border-border pb-5">
        <summary className="w-fit cursor-pointer text-sm font-medium text-accent">
          Crear cuenta
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_90px_70px_auto]">
          <Input
            aria-label="Nombre de nueva cuenta"
            placeholder="Nombre de la cuenta"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Select
            aria-label="Tipo de nueva cuenta"
            value={form.type}
            onChange={(event) =>
              setForm({ ...form, type: event.target.value as AccountType })
            }
          >
            {Object.entries(accountTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Saldo inicial de nueva cuenta"
            type="number"
            step="0.01"
            value={form.initialBalance}
            onChange={(event) =>
              setForm({ ...form, initialBalance: event.target.value })
            }
          />
          <Input
            aria-label="Moneda de nueva cuenta"
            value={form.currency}
            maxLength={3}
            onChange={(event) =>
              setForm({ ...form, currency: event.target.value.toUpperCase() })
            }
          />
          <Input
            aria-label="Color de nueva cuenta"
            type="color"
            value={form.color}
            onChange={(event) =>
              setForm({ ...form, color: event.target.value })
            }
          />
          <Button onClick={() => void createAccount()}>
            <Plus className="h-4 w-4" />
            Crear cuenta
          </Button>
        </div>
      </details>
      {message ? <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{message}</p> : null}
      <section aria-label="Tus cuentas">
        <h2 className="mb-4 text-base font-semibold">Tus cuentas</h2>
        {!accounts.length ? (
          <p className="empty-state">
            Todavía no tienes cuentas. Crea la primera para organizar tus
            movimientos.
          </p>
        ) : null}
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {accounts.map((account) => (
            <article
              key={account.id}
              className={
                "surface min-w-0 p-5 sm:p-6 " +
                (account.isArchived ? "opacity-70" : "")
              }
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: account.color ?? "#65d9aa" }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold">
                    {account.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {accountTypeLabels[account.type]} · {account.currency}
                  </p>
                </div>
                <span className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                  {account.isArchived ? "Archivada" : "Activa"}
                </span>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">Saldo actual</p>
              <p className="mt-2 break-words text-3xl font-semibold tabular-nums">
                {money(account.currentBalance)}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-border py-4 text-xs">
                <div>
                  <dt className="text-muted-foreground">Saldo inicial</dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {money(account.initialBalance)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Movimientos</dt>
                  <dd className="mt-1 font-medium">
                    {account._count.transactions}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 min-h-8 text-[11px] leading-relaxed text-muted-foreground">
                {account.confirmedBalance == null
                  ? "Calculado desde el saldo inicial y los movimientos."
                  : `Saldo bancario: ${money(account.confirmedBalance)} · ${formatDate(account.confirmedAt)}`}
              </p>
              {editingId === account.id ? (
                <div className="mt-4 grid gap-3">
                  <Input
                    aria-label="Nombre de la cuenta"
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm({ ...editForm, name: event.target.value })
                    }
                  />
                  <Select
                    aria-label="Tipo de cuenta"
                    value={editForm.type}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        type: event.target.value as AccountType,
                      })
                    }
                  >
                    {Object.entries(accountTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label="Saldo inicial"
                    type="number"
                    step="0.01"
                    value={editForm.initialBalance}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        initialBalance: event.target.value,
                      })
                    }
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      aria-label="Moneda de la cuenta"
                      value={editForm.currency}
                      maxLength={3}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          currency: event.target.value.toUpperCase(),
                        })
                      }
                    />
                    <Input
                      aria-label="Color de la cuenta"
                      type="color"
                      value={editForm.color}
                      onChange={(event) =>
                        setEditForm({ ...editForm, color: event.target.value })
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void saveAccount(account)}>
                      <Save className="h-4 w-4" />
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => startEditing(account)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void toggleArchive(account)}
                  >
                    {account.isArchived ? (
                      <RotateCcw className="h-3.5 w-3.5" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                    {account.isArchived ? "Reactivar" : "Archivar"}
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
