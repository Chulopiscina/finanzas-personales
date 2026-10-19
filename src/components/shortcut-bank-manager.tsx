"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Save, Unlink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useDialogFocus } from "@/components/use-dialog-focus";
import { request } from "@/lib/client-request";

export type ShortcutBankOption = { id: string; name: string; status: string };
export type ShortcutBankRow = { bankId: string; accountId: string; account: { name: string; isArchived: boolean } };

export function ShortcutBankManager({ deviceId, accounts, banks, bindings, onSaved }: {
  deviceId: string; accounts: Array<{ id: string; name: string }>; banks: ShortcutBankOption[]; bindings: ShortcutBankRow[]; onSaved: (rows: ShortcutBankRow[]) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [bankId, setBank] = useState(banks[0]?.id ?? "");
  const [accountId, setAccount] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useDialogFocus(open, () => setOpen(false));
  const binding = bindings.find(b => b.bankId === bankId);
  async function save(remove = false) {
    if (remove && !window.confirm("¿Desvincular este banco? Los avisos futuros quedarán sin cuenta. No se borrarán movimientos ni avisos.")) return;
    setBusy(true); setError("");
    try {
      const response = await request("/api/integrations/shortcuts/bindings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, bankId, accountId: remove ? null : accountId }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "No se pudo guardar la vinculación."); return; }
      onSaved(data.bindings); router.refresh(); setOpen(false);
    } catch { setError("No se pudo comprobar el resultado. Actualiza antes de repetir."); }
    finally { setBusy(false); }
  }
  return <>
    <Button size="sm" variant="secondary" onClick={() => { setOpen(true); setAccount(binding?.accountId ?? ""); setError(""); }}><Landmark className="h-4 w-4" />Gestionar bancos</Button>
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby={`banks-${deviceId}`} className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-5 text-left shadow-lg">
      <header className="flex items-center justify-between gap-3"><h2 id={`banks-${deviceId}`} className="font-semibold">Bancos de este iPhone</h2><Button size="icon" variant="ghost" title="Cerrar bancos" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></header>
      <label className="block space-y-1 text-sm">Banco<Select aria-label="Banco vinculado" value={bankId} onChange={e => { setBank(e.target.value); setAccount(bindings.find(b => b.bankId === e.target.value)?.accountId ?? ""); }}>{banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
      <p className="text-xs text-muted-foreground">{banks.find(b => b.id === bankId)?.status}</p>
      <label className="block space-y-1 text-sm">Cuenta para futuros avisos<Select aria-label="Cuenta vinculada" value={accountId} onChange={e => setAccount(e.target.value)}><option value="">Selecciona una cuenta</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></label>
      <p className="text-xs text-muted-foreground">Una cuenta por banco en este iPhone. Si tienes varias y el aviso no distingue la cuenta, revísalo antes de conciliar. Cambiar esta relación no reasigna avisos anteriores.</p>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !accountId} onClick={() => void save()}><Save className="h-4 w-4" />Guardar vinculación</Button>{binding ? <Button variant="ghost" disabled={busy} onClick={() => void save(true)}><Unlink className="h-4 w-4" />Desvincular banco</Button> : null}</div>
    </section></div> : null}
  </>;
}
