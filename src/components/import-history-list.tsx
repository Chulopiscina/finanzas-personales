"use client";

import Link from "next/link";
import { Download, Eye, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, numberFormatter } from "@/lib/format";

type ImportHistoryRow = {
  id: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  insertedRows: number;
  duplicateRows: number;
  incomeTotal: unknown;
  expenseTotal: unknown;
  status: "COMPLETED" | "FAILED" | "PENDING";
  createdAt: Date | string;
  account: { id: string; name: string };
};

function toNumber(value: unknown) {
  return Number(value && typeof value === "object" && "toString" in value ? value.toString() : value);
}

function formatBytes(bytes: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: ImportHistoryRow["status"]) {
  if (status === "COMPLETED") return "Correcto";
  if (status === "FAILED") return "Con errores";
  return "Pendiente";
}

export function ImportHistoryList({ imports }: { imports: ImportHistoryRow[] }) {
  const [items, setItems] = useState(imports);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function remove(id: string, deleteTransactions: boolean) {
    const confirmed = window.confirm(
      deleteTransactions
        ? "Esto eliminará los movimientos importados desde este extracto. Esta acción no se puede deshacer."
        : "Se eliminará solo el registro del documento. Los movimientos importados se conservarán."
    );
    if (!confirmed) return;

    setPendingId(id);
    setError("");
    const response = await fetch(`/api/imports/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteTransactions })
    });
    const payload = await response.json().catch(() => ({}));
    setPendingId(null);
    if (!response.ok) {
      setError(payload.error ?? "No se pudo eliminar el extracto.");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-accent">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-card-foreground">Extractos subidos</h2>
          <p className="text-sm text-muted-foreground">Documentos originales, cuenta asociada y movimientos importados.</p>
        </div>
      </div>

      {error ? <div className="m-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}

      {items.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Todavía no has subido ningún extracto.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Archivo</th>
                <th className="px-4 py-3 font-medium">Cuenta</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 text-right font-medium">Movimientos</th>
                <th className="px-4 py-3 text-right font-medium">Ingresos</th>
                <th className="px-4 py-3 text-right font-medium">Gastos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-medium text-card-foreground">{item.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(item.fileSize)}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.account.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                    {numberFormatter.format(item.insertedRows)} / {numberFormatter.format(item.rowCount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-success">{formatCurrency(toNumber(item.incomeTotal))}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-danger">{formatCurrency(toNumber(item.expenseTotal))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{statusLabel(item.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/movements?importId=${item.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground" title="Ver movimientos">
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <a href={`/api/imports/${item.id}/download`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground" title="Descargar archivo">
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </a>
                      <Button type="button" variant="ghost" size="icon" onClick={() => void remove(item.id, false)} disabled={pendingId === item.id} title="Eliminar solo documento">
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="danger" size="icon" onClick={() => void remove(item.id, true)} disabled={pendingId === item.id} title="Eliminar documento y movimientos">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}