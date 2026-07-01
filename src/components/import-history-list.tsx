import { Download, FileText } from "lucide-react";
import { formatDate, numberFormatter } from "@/lib/format";

type ImportHistoryRow = {
  id: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  insertedRows: number;
  duplicateRows: number;
  createdAt: Date | string;
};

function formatBytes(bytes: number) {
  if (!bytes) {
    return "-";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportHistoryList({ imports }: { imports: ImportHistoryRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-accent">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-card-foreground">CSV guardados en tu perfil</h2>
          <p className="text-sm text-muted-foreground">Archivos originales importados por este usuario</p>
        </div>
      </div>

      {imports.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Todavia no has subido ningun CSV.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Archivo</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 text-right font-medium">Tamano</th>
                <th className="px-4 py-3 text-right font-medium">Filas</th>
                <th className="px-4 py-3 text-right font-medium">Insertadas</th>
                <th className="px-4 py-3 text-right font-medium">Duplicadas</th>
                <th className="px-4 py-3 text-right font-medium">Descarga</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-medium text-card-foreground">{item.fileName}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                    {formatBytes(item.fileSize)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                    {numberFormatter.format(item.rowCount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-success">
                    {numberFormatter.format(item.insertedRows)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                    {numberFormatter.format(item.duplicateRows)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/imports/${item.id}/download`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      title="Descargar CSV"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </a>
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
