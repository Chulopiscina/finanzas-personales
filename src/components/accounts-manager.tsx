"use client";

import { Archive, Plus, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

type AccountType = "BANK" | "SAVINGS" | "CARD" | "CASH" | "INVESTMENT" | "DEBT" | "OTHER";

type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: unknown;
  currency: string;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
  _count: { transactions: number; imports: number };
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

function toNumber(value: unknown) {
  return Number(value && typeof value === "object" && "toString" in value ? value.toString() : value);
}

export function AccountsManager({ initialAccounts }: { initialAccounts: AccountRow[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState({ name: "", type: "BANK" as AccountType, initialBalance: "0", color: "#14b8a6" });
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
    setAccounts((current) => [...current, { ...payload.account, _count: { transactions: 0, imports: 0 } }]);
    setForm({ name: "", type: "BANK", initialBalance: "0", color: "#14b8a6" });
  }

  async function toggleArchive(account: AccountRow) {
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
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-card-foreground">Nueva cuenta</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <Input placeholder="Nombre" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as AccountType })}>
            {Object.entries(accountTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input type="number" step="0.01" value={form.initialBalance} onChange={(event) => setForm({ ...form, initialBalance: event.target.value })} />
          <Input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
          <Button type="button" onClick={() => void createAccount()}>
            <Plus className="h-4 w-4" /> Crear
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm text-danger">{message}</p> : null}
      </section>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5">
          <h2 className="text-base font-semibold text-card-foreground">Cuentas</h2>
          <p className="text-sm text-muted-foreground">Elige una cuenta al importar extractos o filtra el dashboard por cuenta.</p>
        </div>
        {accounts.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No hay cuentas todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Cuenta</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo inicial</th>
                  <th className="px-4 py-3 text-right font-medium">Movimientos</th>
                  <th className="px-4 py-3 text-right font-medium">Extractos</th>
                  <th className="px-4 py-3 text-right font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: account.color ?? "#94a3b8" }} />
                        <span className="font-medium text-card-foreground">{account.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{accountTypeLabels[account.type]}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(toNumber(account.initialBalance))}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{account._count.transactions}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{account._count.imports}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{account.isArchived ? "Archivada" : "Activa"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="secondary" size="sm" onClick={() => void toggleArchive(account)}>
                        {account.isArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        {account.isArchived ? "Reactivar" : "Archivar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}