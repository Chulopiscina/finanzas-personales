"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ExternalLink, Link2, LoaderCircle, ShieldCheck, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useDialogFocus } from "@/components/use-dialog-focus";
import { request } from "@/lib/client-request";

type Pairing = { id: string; expiresAt: string; setupUrl?: string; status?: string; lastNotificationAt?: string | null };
const linkClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function ShortcutConnectWizard({ accounts, installUrl, initialPairingId }: {
  accounts: Array<{ id: string; name: string }>;
  installUrl: string | null;
  initialPairingId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(initialPairingId));
  const [step, setStep] = useState(initialPairingId ? 2 : 0);
  const [accountId, setAccount] = useState(accounts.length === 1 ? accounts[0].id : "");
  const [consent, setConsent] = useState(false);
  const [pairing, setPairing] = useState<Pairing | null>(initialPairingId ? { id: initialPairingId, expiresAt: "" } : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { setOpen(false); router.refresh(); };
  useDialogFocus(open, close);

  useEffect(() => {
    if (!open || !pairing?.id) return;
    let canceled = false, running = false;
    const id = pairing.id;
    const refresh = async () => {
      if (document.hidden || running) return;
      running = true;
      try {
        const response = await request(`/api/integrations/shortcuts/pairing?id=${encodeURIComponent(id)}`);
        const data = await response.json();
        if (!canceled) {
          if (response.ok) { setPairing(previous => previous?.id === id ? { ...previous, ...data } : previous); setError(""); }
          else setError(data.error ?? "No se pudo comprobar la conexión.");
        }
      } catch { if (!canceled) setError("No se pudo comprobar la conexión. Vuelve a intentarlo al recuperar la conexión."); }
      finally { running = false; }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10_000);
    const stop = window.setTimeout(() => window.clearInterval(interval), 10 * 60_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    return () => { canceled = true; window.clearInterval(interval); window.clearTimeout(stop); document.removeEventListener("visibilitychange", visible); window.removeEventListener("focus", visible); };
  }, [open, pairing?.id]);

  async function prepare() {
    setBusy(true); setError("");
    try {
      const response = await request("/api/integrations/shortcuts/pairing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, consent }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "No se pudo preparar la conexión."); return; }
      setPairing({ ...data, status: "waiting" }); setStep(2);
    } catch { setError("No se pudo preparar la conexión. No vuelvas a vincular hasta comprobar su estado."); }
    finally { setBusy(false); }
  }
  const linked = ["paired", "verified"].includes(pairing?.status ?? "");
  const invalid = ["expired", "canceled", "disconnected", "unavailable"].includes(pairing?.status ?? "");
  return <>
    <section className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
      <div><h2 className="text-lg font-semibold">BBVA en tu iPhone</h2><p className="mt-1 text-sm text-muted-foreground">Conexión por Atajos. Sin contraseñas bancarias.</p></div>
      <Button onClick={() => { setOpen(true); setError(""); }}><Link2 className="h-4 w-4" />Conectar BBVA</Button>
    </section>
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="bbva-connect-title" className="max-h-[92dvh] w-full max-w-lg space-y-5 overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-lg sm:p-6">
        <header className="flex items-center justify-between gap-3"><h2 id="bbva-connect-title" className="text-lg font-semibold">Conectar BBVA</h2><Button size="icon" variant="ghost" title="Cerrar conexión BBVA" onClick={close}><X className="h-4 w-4" /></Button></header>
        {!installUrl ? <div className="space-y-4"><ShieldCheck className="h-8 w-8 text-accent" /><p className="font-medium">El atajo todavía no está disponible</p><p className="text-sm text-muted-foreground">La conexión guiada estará disponible cuando se publique el atajo verificado para iPhone. Puedes seguir importando tus extractos.</p><Button variant="secondary" onClick={close}>Entendido</Button></div> : <>
          <ol aria-label="Progreso de conexión" className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">{["Cuenta", "Instalar", "Vincular", "Automatizar"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={`border-t-2 pt-2 ${index <= step ? "border-accent text-foreground" : "border-border"}`}>{index + 1}. {label}</li>)}</ol>
          {step === 0 ? <div className="space-y-4">
            <label className="block space-y-2 text-sm">Cuenta para las notificaciones BBVA<Select aria-label="Cuenta BBVA" value={accountId} onChange={e => setAccount(e.target.value)}><option value="">Selecciona una cuenta</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></label>
            <p className="text-xs text-muted-foreground">Todas las notificaciones BBVA de este atajo irán a la cuenta que elijas.</p>
            {!accounts.length ? <p className="text-sm text-muted-foreground">Necesitas una cuenta activa en euros.</p> : null}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />Autorizo enviar el texto de las notificaciones BBVA a mi perfil de Finanzas Personales.</label>
            <p className="text-xs text-muted-foreground">Serán provisionales: no modificarán tus saldos ni se contarán como gastos reales.</p>
            <Button disabled={!accountId || !consent} onClick={() => setStep(1)}>Continuar<ArrowRight className="h-4 w-4" /></Button>
          </div> : null}
          {step === 1 ? <div className="space-y-4"><Smartphone className="h-8 w-8 text-accent" /><h3 className="font-medium">Añade Finanzas BBVA</h3><p className="text-sm text-muted-foreground">Necesitas iOS 27. Abre el enlace en tu iPhone y confirma «Añadir atajo». Si Safari descarga un archivo, ábrelo desde Descargas y compártelo con Atajos. Después vuelve aquí.</p><a href={installUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>Instalar atajo<ExternalLink className="h-4 w-4" /></a><div><Button variant="secondary" disabled={busy} onClick={() => void prepare()}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Ya lo he añadido</Button></div></div> : null}
          {step === 2 ? <div className="space-y-4">
            <h3 className="font-medium">{linked ? "iPhone vinculado" : invalid ? "Vuelve a vincular el iPhone" : "Vincula este iPhone"}</h3>
            {linked ? <><p role="status" className="text-sm text-accent">{pairing?.status === "verified" ? "El atajo ha comprobado la conexión." : "Vinculado. Falta que el atajo compruebe la conexión."}</p><Button onClick={() => setStep(3)}>Configurar automatización<ArrowRight className="h-4 w-4" /></Button></> : invalid ? <><p className="text-sm text-muted-foreground">El enlace ha caducado, se ha sustituido, se ha desconectado o la cuenta ya no está disponible.</p><Button onClick={() => { setPairing(null); setStep(0); }}>Empezar de nuevo</Button></> : <>
              <p className="text-sm text-muted-foreground">Abre el atajo para vincularlo de forma privada y después vuelve a esta pantalla. Si se abre Safari, regresa al icono de tu PWA. No necesitas copiar ninguna clave.</p>
              {pairing?.setupUrl ? <a href={pairing.setupUrl} referrerPolicy="no-referrer" className={linkClass}>Vincular este iPhone<ExternalLink className="h-4 w-4" /></a> : <p className="text-sm text-muted-foreground">Esperando la comprobación del atajo. Si no termina, inicia una nueva conexión.</p>}
              <p className="text-xs text-muted-foreground">El enlace caduca en cinco minutos y solo se puede usar una vez. No lo compartas.</p>
              <div><Button variant="ghost" onClick={() => { setPairing(null); setStep(0); }}>Iniciar una nueva conexión</Button></div>
            </>}
          </div> : null}
          {step === 3 ? <div className="space-y-4"><h3 className="font-medium">Activa las notificaciones en Atajos</h3><ol className="space-y-3 text-sm">{[
            ["1", "Abre Finanzas BBVA", "En Atajos, abre el atajo instalado y entra en Editar → Automatización."],
            ["2", "Selecciona Notificación → BBVA", "Elige solo la app BBVA. Si no aparece este disparador, tu versión de iOS no permite este flujo."],
            ["3", "Confirma los permisos de Apple", "Guarda la automatización y permite el envío a tu web. La ejecución bloqueada depende de iOS y debe probarse."],
          ].map(([number, title, text]) => <li key={number} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 font-medium text-accent">{number}</span><div><p className="font-medium">{title}</p><p className="mt-1 text-muted-foreground">{text}</p></div></li>)}</ol><p role="status" className="rounded-md border border-border p-3 text-sm">{pairing?.lastNotificationAt ? "Primera notificación recibida. Revísala en la bandeja provisional." : "Todavía no hemos recibido una notificación BBVA. Vincular el atajo no confirma que la automatización esté activa."}</p><Button onClick={close}>Volver a mis notificaciones</Button></div> : null}
        </>}
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </section>
    </div> : null}
  </>;
}
