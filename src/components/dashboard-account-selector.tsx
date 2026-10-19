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
    <label className="finance-select">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
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
      </Select>
    </label>
  );
}
