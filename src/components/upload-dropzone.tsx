"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImportResult = {
  fileName: string;
  rowCount: number;
  insertedRows: number;
  duplicateRows: number;
  createdAt: string;
};

export function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function upload(file: File) {
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/imports", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo importar el archivo.");
      return;
    }

    setResult(payload.import);
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
        <Button type="button" className="mt-6" onClick={() => inputRef.current?.click()} disabled={loading}>
          <FileUp className="h-4 w-4" />
          Seleccionar archivo
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</div>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-medium">Importación completada</p>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Archivo</dt>
              <dd className="truncate font-medium text-foreground">{result.fileName}</dd>
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
