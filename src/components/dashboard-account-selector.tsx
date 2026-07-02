"use client";

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
    <Select value={selectedAccountId ?? ""} onChange={(event) => changeAccount(event.target.value)} className="w-full sm:w-64">
      <option value="">Todas las cuentas</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}{account.isArchived ? " (archivada)" : ""}
        </option>
      ))}
    </Select>
  );
}