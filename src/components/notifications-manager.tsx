"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Plus, RefreshCw, ShieldX, Unlink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useDialogFocus } from "@/components/use-dialog-focus";
import { request } from "@/lib/client-request";
import { formatCurrency, formatDate } from "@/lib/format";
import { ShortcutConnectWizard } from "@/components/shortcut-connect-wizard";

type EventRow = { id: string; body: string; title: string | null; merchant: string | null; amount: number | null; currency: string | null; occurredAt: string | null; receivedAt: string; categoryName: string | null; account: string; status: string; reason: string; transactionId: string | null };
type Candidate = { id: string; date: string; concept: string; cleanDescription: string | null; amount: string };
const statusNames: Record<string, string> = { PENDING: "Provisional", REVIEW: "Revisar", AUTHORIZATION: "Retención", REVERSED: "Anulación", RECONCILED: "Conciliada", DISMISSED: "Descartada" };

export function NotificationsManager({ accounts, devices: initialDevices, events: initialEvents, installUrl, initialPairingId }: {
  accounts: Array<{ id: string; name: string }>;
  devices: Array<{ id: string; name: string; account: string; revoked: boolean; expiresAt: string; lastVerifiedAt?: string | null; lastUsedAt?: string | null }>;
  events: EventRow[];
  installUrl: string | null;
  initialPairingId?: string;
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [devices, setDevices] = useState(initialDevices);
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => setEvents(initialEvents), [initialEvents]);
  useEffect(() => setDevices(initialDevices), [initialDevices]);
  const [name, setName] = useState("");
  const [accountId, setAccount] = useState(accounts[0]?.id ?? "");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useDialogFocus(Boolean(event), () => setEvent(null));

  async function mutate(path: string, method: string, body: object) {
    setBusy(true); setError("");
    try {
      const response = await request(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "No se pudo completar la operación."); return null; }
      if (data.event) setEvents((rows) => rows.map((row) => row.id === data.event.id ? { ...row, ...data.event } : row));
      if (data.device) setDevices((rows) => [data.device, ...rows]);
      if (data.revokedId) setDevices((rows) => rows.map((row) => row.id === data.revokedId ? { ...row, revoked: true } : row));
      return data;
    } finally { setBusy(false); }
  }
  async function loadCandidates(row: EventRow, query = "") {
    setBusy(true); setError("");
    try {
      const response = await request(`/api/integrations/shortcuts/inbox?id=${encodeURIComponent(row.id)}&search=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) { setError(data.error); return; }
      setCandidates(data.candidates);
    } finally { setBusy(false); }
  }
  async function openLink(row: EventRow) {
    setEvent(row); setSearch(""); setSelected(""); setConfirmed(false); setCandidates([]);
    await loadCandidates(row);
  }
  return <div className="space-y-8">
    <ShortcutConnectWizard accounts={accounts} installUrl={installUrl} initialPairingId={initialPairingId} />
    {error ? <p role="alert" className="rounded-md border border-danger/30 p-3 text-sm text-danger">{error}</p> : null}
    <section className="space-y-4 border-b border-border pb-6">
      <h2 className="text-lg font-semibold">Atajos autorizados</h2>
      <details className="space-y-3"><summary className="cursor-pointer text-sm text-muted-foreground">Configuración avanzada</summary>
      <form className="grid items-end gap-3 pt-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={async (e) => { e.preventDefault(); const data = await mutate("/api/integrations/shortcuts/devices", "POST", { name, accountId }); if (data) { setToken(data.token); setName(""); } }}>
        <label className="space-y-1 text-sm">Nombre<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required /></label>
        <label className="space-y-1 text-sm">Cuenta<Select aria-label="Cuenta" value={accountId} onChange={(e) => setAccount(e.target.value)} required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></label>
        <Button disabled={busy || !accountId}><Plus className="h-4 w-4" />Crear credencial</Button>
      </form>
      {token ? <div className="space-y-3 rounded-lg border border-accent/30 p-4">
        <p className="text-sm font-medium">Credencial privada · caduca en 90 días · visible solo ahora</p>
        <code className="block break-all text-sm">{token}</code>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(token); } catch { setError("No se pudo copiar la credencial."); } }}><Copy className="h-4 w-4" />Copiar</Button><Button size="sm" variant="ghost" onClick={() => setToken("")}><X className="h-4 w-4" />Ocultar</Button></div>
      </div> : null}
      </details>
      <ul className="divide-y divide-border">{devices.map((device) => <li key={device.id} data-testid={`shortcut-device-${device.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="break-words font-medium">{device.name} · {device.account}</p><p className="mt-1 text-xs text-muted-foreground">{device.revoked ? "Desconectado" : new Date(device.expiresAt) <= new Date() ? "Conexión caducada" : device.lastUsedAt ? `Última notificación: ${formatDate(device.lastUsedAt)}` : device.lastVerifiedAt ? "Conexión comprobada · esperando notificaciones" : "Vinculado · pendiente de comprobación"}</p><p className="text-xs text-muted-foreground">Caduca {formatDate(device.expiresAt)}</p></div>{!device.revoked ? <Button size="sm" variant="ghost" disabled={busy} onClick={async () => { if (window.confirm("¿Desconectar este iPhone? Dejará de recibir notificaciones. Los movimientos y notificaciones guardados se conservarán.")) await mutate("/api/integrations/shortcuts/devices", "DELETE", { id: device.id }); }}><ShieldX className="h-4 w-4" />Desconectar</Button> : null}</li>)}</ul>
    </section>
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Bandeja provisional</h2><Button size="icon" variant="ghost" title="Actualizar bandeja" disabled={busy || refreshing} onClick={() => startRefresh(() => router.refresh())}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></Button></div>
      {!events.length ? <p className="py-8 text-center text-sm text-muted-foreground">No hay notificaciones recibidas.</p> : <ul className="divide-y divide-border">{events.map((row) => <li key={row.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{row.merchant || row.title || "Notificación bancaria"}</strong><span className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">{statusNames[row.status] ?? "Revisar"}</span></div>
          <p className="break-words text-sm text-muted-foreground">{row.body}</p><p className="text-xs text-muted-foreground">{row.account} · {row.occurredAt ? formatDate(row.occurredAt) : "Sin fecha bancaria"} · Recibida {formatDate(row.receivedAt)}{row.categoryName ? ` · ${row.categoryName}` : ""}</p><p className="text-xs text-muted-foreground">{row.reason}</p>
        </div>
        <div className="space-y-2 md:text-right"><p className="font-semibold tabular-nums">{row.amount === null ? "Importe sin confirmar" : row.currency === "EUR" ? formatCurrency(row.amount) : `${row.amount} ${row.currency ?? ""}`}</p><div className="flex flex-wrap gap-2 md:justify-end">
          {row.transactionId ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => mutate("/api/integrations/shortcuts/inbox", "PATCH", { id: row.id, action: "unlink" })}><Unlink className="h-4 w-4" />Quitar vínculo</Button> : <Button size="sm" variant="secondary" disabled={busy} onClick={() => openLink(row)}><Link2 className="h-4 w-4" />Conciliar</Button>}
          {row.status !== "DISMISSED" ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (window.confirm("¿Descartar esta notificación? Se conservará el original y no se borrarán movimientos.")) void mutate("/api/integrations/shortcuts/inbox", "PATCH", { id: row.id, action: "dismiss" }); }}><X className="h-4 w-4" />Descartar</Button> : null}
        </div></div>
      </li>)}</ul>}
    </section>
    {event ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="reconcile-title" className="max-h-[90dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg">
      <div className="flex items-center justify-between"><h2 id="reconcile-title" className="font-semibold">Conciliar notificación</h2><Button size="icon" variant="ghost" title="Cerrar" onClick={() => setEvent(null)}><X className="h-4 w-4" /></Button></div>
      <p className="text-sm text-muted-foreground">{event.account} · {event.merchant || event.title || event.body}</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void loadCandidates(event, search); }}><Input aria-label="Buscar movimiento definitivo" placeholder="Buscar movimiento definitivo" value={search} onChange={(e) => setSearch(e.target.value)} /><Button variant="secondary" disabled={busy}>Buscar</Button></form>
      <label className="block space-y-2 text-sm">Movimiento definitivo<Select aria-label="Movimiento definitivo" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Seleccionar movimiento</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{formatDate(candidate.date)} · {candidate.cleanDescription || candidate.concept} · {formatCurrency(Number(candidate.amount))}</option>)}</Select></label>
      {!busy && !candidates.length ? <p className="text-sm text-muted-foreground">No hay coincidencias. Importa el extracto o busca por concepto.</p> : null}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Confirmo que corresponde a esta operación definitiva, aunque su importe o fecha difieran de la retención inicial. No se modificará el movimiento bancario.</label>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button disabled={busy || !selected || !confirmed} onClick={async () => { if (await mutate("/api/integrations/shortcuts/inbox", "PATCH", { id: event.id, action: "link", transactionId: selected, confirmed })) setEvent(null); }}><Check className="h-4 w-4" />Confirmar vínculo</Button>
    </section></div> : null}
  </div>;
}
