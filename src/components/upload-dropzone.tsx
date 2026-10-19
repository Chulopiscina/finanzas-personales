"use client";
import { request } from "@/lib/client-request";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileSearch, FileUp, Loader2, RotateCcw, UploadCloud, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type AccountOption = {
  id: string;
  name: string;
  type: string;
  color: string | null;
};

type ImportResult = {
  id?: string;
  fileName: string;
  rowCount: number;
  insertedRows: number;
  duplicateRows: number;
  accountName?: string;
  createdAt: string;
};

type PreviewMovement = {
  date: string;
  concept: string;
  amount: number;
  balance: number | null;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  categoryName: string;
  sourceHash: string;
};

type ImportPreview = {
  id: string;
  accountName: string;
  bankName: string;
  detectedFormat: string;
  fileName: string;
  movements: PreviewMovement[];
  rowCount: number;
  startDate: string | null;
  endDate: string | null;
  incomeTotal: number;
  expenseTotal: number;
  openingBalance: number | null;
  closingBalance: number | null;
  balanceDifference: number | null;
  validationStatus: "correcto" | "aviso" | "error";
  confidence: "alta" | "media" | "baja";
  messages: string[];
};

type ImportResponse = {
  preview?: ImportPreview;
  import?: ImportResult;
  error?: string;
};

const bankFormatOptions = [
  { value: "AUTO", label: "Detectar automaticamente" },
  { value: "BBVA", label: "BBVA" },
  { value: "TRADE_REPUBLIC", label: "Trade Republic" },
  { value: "ING", label: "ING" },
  { value: "CAIXABANK", label: "CaixaBank" },
  { value: "UNSUPPORTED", label: "Otros / no soportado" }
];

const typeLabels = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia"
};

function parseImportResponse(text: string): ImportResponse {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as ImportResponse;
  } catch {
    return { error: "El servidor devolvio una respuesta inesperada." };
  }
}

function statusTone(status: ImportPreview["validationStatus"]) {
  if (status === "correcto") return "success" as const;
  if (status === "aviso") return "warning" as const;
  return "danger" as const;
}

function confidenceTone(confidence: ImportPreview["confidence"]) {
  if (confidence === "alta") return "success" as const;
  if (confidence === "media") return "warning" as const;
  return "danger" as const;
}

function nullableCurrency(value: number | null) {
  return value === null ? "-" : formatCurrency(value);
}

export function UploadDropzone({ accounts }: { accounts: AccountOption[] }) {
  const searchParams = useSearchParams();
  const [previewPage, setPreviewPage] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [bankFormat, setBankFormat] = useState("AUTO");
  const [forceLowConfidence, setForceLowConfidence] = useState(false);
  const selectedAccount = useMemo(() => accounts.find((account) => account.id === accountId), [accounts, accountId]);
  const resumeId = searchParams.get("previewId");
  useEffect(() => {
    if (!resumeId) return;
    const controller = new AbortController();
    void request(`/api/imports/${resumeId}/preview`, { signal: controller.signal }).then(async (response) => {
      const payload = parseImportResponse(await response.text());
      if (controller.signal.aborted) return;
      if (!response.ok || !payload.preview) { setError(payload.error ?? "No se pudo abrir la revisión."); return; }
      setPreview(payload.preview); setAccountId(accounts.find((account) => account.name === payload.preview?.accountName)?.id ?? "");
    });
    return () => controller.abort();
  }, [resumeId, accounts]);
  async function changePreviewPage(page: number) {
    if (!preview) return;
    setLoading(true);
    const response = await request(`/api/imports/${preview.id}/preview?page=${page}`);
    const payload = parseImportResponse(await response.text());
    if (response.ok && payload.preview) { setPreview(payload.preview); setPreviewPage(page); }
    else setError(payload.error ?? "No se pudo cargar esa página.");
    setLoading(false);
  }

  async function analyze(file: File, format = bankFormat) {
    if (file.size > 4 * 1024 * 1024) { setError("El archivo no puede superar los 4 MB."); return; }
    if (!accountId) {
      setError("Selecciona una cuenta antes de analizar el extracto.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    setResult(null);
    setPreview(null);
    setForceLowConfidence(false);
    setActiveFile(file);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountId", accountId);
    formData.append("bankFormat", format);
    if (preview?.id) formData.append("previousImportId", preview.id);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60000);

    try {
      const response = await request("/api/imports", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      const text = await response.text();
      const payload = parseImportResponse(text);

      if (!response.ok) {
        setError(payload.error ?? "No se pudo analizar el archivo. No se ha guardado ningun movimiento.");
        return;
      }

      if (!payload.preview) {
        setError(payload.error ?? "El servidor no devolvio la vista previa de importacion.");
        return;
      }

      setPreview(payload.preview);
      setPreviewPage(1);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setError("El analisis esta tardando demasiado. Prueba otra vez o sube un PDF mas pequeno.");
        return;
      }

      setError(error instanceof Error ? error.message : "No se pudo analizar el archivo.");
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await request(`/api/imports/${preview.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: forceLowConfidence })
      });
      const payload = parseImportResponse(await response.text());
      if (!response.ok) {
        setError(payload.error ?? "No se pudo confirmar la importacion.");
        return;
      }
      if (!payload.import) {
        setError(payload.error ?? "El servidor no devolvio el resultado de importacion.");
        return;
      }

      setResult(payload.import);
      setPreview(null);
      setActiveFile(null);
      setNotice("Importacion confirmada y guardada correctamente.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo confirmar la importacion.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelImport() {
    if (!preview) return;
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await request(`/api/imports/${preview.id}/cancel`, { method: "POST" });
      const payload = parseImportResponse(await response.text());
      if (!response.ok) {
        setError(payload.error ?? "No se pudo cancelar la importacion.");
        return;
      }
      setPreview(null);
      setActiveFile(null);
      setNotice("Importacion cancelada. No se ha guardado ningun movimiento.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo cancelar la importacion.");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void analyze(file);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void analyze(file);
    }
  }

  return (
    <div className="space-y-4">
      <section className="border-b border-border pb-5">
        <label className="text-sm font-medium text-card-foreground">Cuenta del extracto</label>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={loading || accounts.length <= 1 || Boolean(preview)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </Select>
          <p className="text-sm text-muted-foreground">
            Estos movimientos se revisaran para: <span className="font-medium text-foreground">{selectedAccount?.name ?? "sin cuenta"}</span>
          </p>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3 py-3 text-xs">
        <div>
          <p className="font-medium text-card-foreground">Bancos soportados</p>
          <p className="mt-1 text-muted-foreground">La importacion siempre requiere confirmacion.</p>
        </div>
        <Badge tone="success">BBVA compatible</Badge>
        <Badge tone="warning">Trade Republic en pruebas</Badge>
        <Badge tone="warning">ING en pruebas</Badge>
      </section>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed bg-card p-6 text-center transition-colors duration-150 sm:p-10",
          dragging ? "border-accent bg-accent/10" : "border-border",
          preview && "opacity-70"
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-accent">
          {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : <UploadCloud className="h-7 w-7" />}
        </div>
        <h2 className="mt-5 text-lg font-semibold text-card-foreground">Analizar CSV o PDF bancario</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Primero se mostrara una vista previa. Los movimientos no se guardan hasta que confirmes la importacion.
        </p>
        <input ref={inputRef} type="file" accept=".csv,.pdf,text/csv,application/pdf" className="hidden" onChange={onChange} />
        <Button type="button" className="mt-6" onClick={() => inputRef.current?.click()} disabled={loading || !accountId || Boolean(preview)}>
          <FileUp className="h-4 w-4" />
          Seleccionar archivo
        </Button>
      </div>

      {error ? <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">{notice}</div> : null}

      {preview ? (
        <section className="movement-layout space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <FileSearch className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-card-foreground">Vista previa de importacion</h3>
                <Badge tone={statusTone(preview.validationStatus)}>{preview.validationStatus}</Badge>
                <Badge tone={confidenceTone(preview.confidence)}>Confianza {preview.confidence}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Revisa los datos antes de guardar movimientos en tu cuenta.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[220px_auto]">
              <Select value={bankFormat} onChange={(event) => setBankFormat(event.target.value)} disabled={loading}>
                {bankFormatOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
              <Button type="button" variant="secondary" onClick={() => activeFile && void analyze(activeFile, bankFormat)} disabled={loading || !activeFile}>
                <RotateCcw className="h-4 w-4" />
                Cambiar formato y reanalizar
              </Button>
            </div>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border bg-background/40 p-3">
              <dt className="text-muted-foreground">Banco/formato</dt>
              <dd className="mt-1 font-medium text-foreground">{preview.bankName}</dd>
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <dt className="text-muted-foreground">Cuenta</dt>
              <dd className="mt-1 font-medium text-foreground">{preview.accountName}</dd>
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <dt className="text-muted-foreground">Archivo</dt>
              <dd className="mt-1 truncate font-medium text-foreground">{preview.fileName}</dd>
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <dt className="text-muted-foreground">Movimientos detectados</dt>
              <dd className="mt-1 font-medium text-foreground">{preview.rowCount}</dd>
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <dt className="text-muted-foreground">Periodo</dt>
              <dd className="mt-1 font-medium text-foreground">{formatDate(preview.startDate)} - {formatDate(preview.endDate)}</dd>
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <dt className="text-muted-foreground">Ingresos detectados</dt>
              <dd className="mt-1 font-medium text-success">{formatCurrency(preview.incomeTotal)}</dd>
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <dt className="text-muted-foreground">Gastos detectados</dt>
              <dd className="mt-1 font-medium text-danger">{formatCurrency(preview.expenseTotal)}</dd>
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <dt className="text-muted-foreground">Saldo inicial / final</dt>
              <dd className="mt-1 font-medium text-foreground">{nullableCurrency(preview.openingBalance)} / {nullableCurrency(preview.closingBalance)}</dd>
            </div>
          </dl>

          {preview.messages.length > 0 ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div className="space-y-1">
                  {preview.messages.map((message) => <p key={message}>{message}</p>)}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />El extracto parece correcto y esta listo para importar.</div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>{preview.rowCount} movimientos · Página {previewPage} / {Math.max(1, Math.ceil(preview.rowCount / 100))}</span>
            <div className="flex gap-2"><Button variant="secondary" size="sm" disabled={loading || previewPage <= 1} onClick={() => void changePreviewPage(previewPage - 1)}>Anterior</Button><Button variant="secondary" size="sm" disabled={loading || previewPage >= Math.ceil(preview.rowCount / 100)} onClick={() => void changePreviewPage(previewPage + 1)}>Siguiente</Button></div>
          </div>
          <div className="movement-mobile space-y-2">
            {preview.movements.map((movement, index) => <article className="rounded-lg border border-border p-3 text-sm" key={index}><div className="flex justify-between gap-3"><span className="text-muted-foreground">{formatDate(movement.date)}</span><strong className={movement.amount < 0 ? "text-danger" : "text-success"}>{formatCurrency(movement.amount)}</strong></div><p className="my-2 break-words">{movement.concept}</p><p className="text-xs text-muted-foreground">{typeLabels[movement.type]} · {movement.categoryName} · Saldo {nullableCurrency(movement.balance)}</p></article>)}
          </div>
          <div className="movement-desktop overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Concepto</th>
                  <th className="px-4 py-3 text-right font-medium">Importe</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.movements.map((movement, index) => (
                  <tr key={`${movement.date}-${movement.sourceHash ?? index}`} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(movement.date)}</td>
                    <td className="max-w-md px-4 py-3 text-foreground">{movement.concept}</td>
                    <td className={cn("whitespace-nowrap px-4 py-3 text-right font-medium", movement.amount >= 0 ? "text-success" : "text-danger")}>{formatCurrency(movement.amount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">{nullableCurrency(movement.balance)}</td>
                    <td className="px-4 py-3"><Badge>{typeLabels[movement.type]}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{movement.categoryName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.confidence === "baja" ? (
            <label className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
              <input type="checkbox" className="mt-1" checked={forceLowConfidence} onChange={(event) => setForceLowConfidence(event.target.checked)} />
              <span>La confianza es baja. Confirmo que he revisado el extracto y quiero importarlo igualmente.</span>
            </label>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => void cancelImport()} disabled={loading}>
              <XCircle className="h-4 w-4" />
              Cancelar importacion
            </Button>
            <Button type="button" onClick={() => void confirmImport()} disabled={loading || preview.validationStatus === "error" || (preview.confidence === "baja" && !forceLowConfidence)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar importacion
            </Button>
          </div>
        </section>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-medium">Importacion completada</p>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-5">
            <div>
              <dt className="text-muted-foreground">Archivo</dt>
              <dd className="truncate font-medium text-foreground">{result.fileName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cuenta</dt>
              <dd className="font-medium text-foreground">{result.accountName ?? selectedAccount?.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Filas</dt>
              <dd className="font-medium text-foreground">{result.rowCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Insertados</dt>
              <dd className="font-medium text-foreground">{result.insertedRows}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Duplicados</dt>
              <dd className="font-medium text-foreground">{result.duplicateRows}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
