"use client";

import { ChevronDown, Landmark } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";

export type AccountOption = {
  id: string;
  name: string;
  isArchived: boolean;
};

export function DashboardAccountSelector({ accounts, selectedAccountId }: { accounts: AccountOption[]; selectedAccountId?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = accounts.find((account) => account.id === selectedAccountId);

  function changeAccount(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("accountId", value);
    else params.delete("accountId");
    router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <label className="group relative flex h-12 min-w-0 items-center gap-3 rounded-full border border-border bg-card px-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 hover:border-accent/30 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] sm:min-w-64">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Landmark className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="pointer-events-none min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {selected?.name ?? "Todas las cuentas"}
      </span>
      <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground transition duration-200 group-hover:text-foreground" aria-hidden="true" />
      <Select value={selectedAccountId ?? ""} onChange={(event) => changeAccount(event.target.value)} aria-label="Seleccionar cuenta" className="absolute inset-0 h-full cursor-pointer opacity-0">
        <option value="">✓ Todas las cuentas</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.id === selectedAccountId ? "✓ " : ""}{account.name}{account.isArchived ? " (archivada)" : ""}
          </option>
        ))}
        <option disabled>Añadir cuenta</option>
      </Select>
    </label>
  );
}
