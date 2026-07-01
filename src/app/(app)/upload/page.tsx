import { UploadDropzone } from "@/components/upload-dropzone";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Subir CSV</h1>
        <p className="text-sm text-muted-foreground">Importación BBVA con detección de duplicados</p>
      </header>
      <UploadDropzone />
    </div>
  );
}
