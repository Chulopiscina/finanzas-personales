"use client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ApplicationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-lg space-y-4 p-6 py-16"><h1 className="text-xl font-semibold">No se han podido cargar tus datos</h1><p className="text-muted-foreground">La conexión con el servicio de datos puede estar temporalmente interrumpida. Tus datos guardados se conservan.</p><Button onClick={reset}><RefreshCw className="h-4 w-4" /> Volver a intentar</Button></main>;
}
