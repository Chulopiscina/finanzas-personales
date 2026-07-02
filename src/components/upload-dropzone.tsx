"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AccountOption = {
  id: string;
  name: string;
  type: string;
  color: string | null;
};

type ImportResult = {
  fileName: string;
  rowCount: number;
  insertedRows: number;
  duplicateRows: number;
  accountName?: string;
  createdAt: string;
};

type ImportResponse = {
  import?: ImportResult;
  error?: string;
};

function parseImportResponse(text: string): ImportResponse {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as ImportResponse;
  } catch {
    return { error: "El servidor devolvió una respuesta inesperada." };
  }
}

export function UploadDropzone({ accounts }: { accounts: AccountOption[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const selectedAccount = useMemo(() => accounts.find((account) => account.id === accountId), [accounts, accountId]);

  async function upload(file: File) {
    if (!accountId) {
      setError("Selecciona una cuenta antes de importar el extracto.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountId", accountId);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch("/api/imports", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      const text = await response.text();
      const payload = parseImportResponse(text);

      if (!response.ok) {
        setError(payload.error ?? "No se pudo importar el archivo.");
        return;
      }

      if (!payload.import) {
        setError(payload.error ?? "El servidor no devolvió el resultado de la importación.");
        return;
      }

      setResult(payload.import);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setError("La importación está tardando demasiado. Prueba otra vez o sube un PDF más pequeño.");
        return;
      }

      setError(error instanceof Error ? error.message : "No se pudo importar el archivo.");
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void upload(file);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void upload(file);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <label className="text-sm font-medium text-card-foreground">Cuenta del extracto</label>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <Select value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={loading || accounts.length <= 1}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </Select>
          <p className="text-sm text-muted-foreground">
            Estos movimientos se importarán en: <span className="font-medium text-foreground">{selectedAccount?.name ?? "sin cuenta"}</span>
          </p>
        </div>
      </section>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center transition",
          dragging ? "border-accent bg-accent/10" : "border-border"
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-accent">
          {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : <UploadCloud className="h-7 w-7" />}
        </div>
        <h2 className="mt-5 text-lg font-semibold text-card-foreground">Importar CSV o PDF BBVA</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Arrastra el archivo o selecciónalo manualmente. Se leerán fecha, concepto, importe y saldo.
        </p>
        <input ref={inputRef} type="file" accept=".csv,.pdf,text/csv,application/pdf" className="hidden" onChange={onChange} />
        <Button type="button" className="mt-6" onClick={() => inputRef.current?.click()} disabled={loading || !accountId}>
          <FileUp className="h-4 w-4" />
          Seleccionar archivo
        </Button>
      </div>

      {error ? <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</div> : null}

      {result ? (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-medium">Importación completada</p>
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