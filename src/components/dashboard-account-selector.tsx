"use client";

import { Landmark } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";

type AccountOption = {
  id: string;
  name: string;
  isArchived: boolean;
};

export function DashboardAccountSelector({ accounts, selectedAccountId }: { accounts: AccountOption[]; selectedAccountId?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function changeAccount(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("accountId", value);
    } else {
      params.delete("accountId");
    }
    router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <label className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm sm:w-80">
      <span className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <Landmark className="h-4 w-4" aria-hidden="true" />
        Vista del dashboard
      </span>
      <Select value={selectedAccountId ?? ""} onChange={(event) => changeAccount(event.target.value)} className="h-11 bg-muted/40">
        <option value="">Todas las cuentas activas</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}{account.isArchived ? " (archivada)" : ""}
          </option>
        ))}
      </Select>
    </label>
  );
}
