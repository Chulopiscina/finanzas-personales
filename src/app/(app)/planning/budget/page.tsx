import Link from "next/link";
import { WalletCards } from "lucide-react";
import { getSessionUser } from "@/lib/auth";

export default async function BudgetPlaceholderPage() {
  const session = await getSessionUser();
  if (!session) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Presupuesto mensual</h1>
        <p className="text-sm text-muted-foreground">Esta sección queda preparada para configurar presupuestos cuando se conecte la lógica.</p>
      </header>
      <section className="rounded-2xl border border-orange-500/20 bg-card p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-300">
              <WalletCards className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Estado</p>
              <p className="mt-1 text-2xl font-semibold text-card-foreground">Sin presupuesto configurado</p>
            </div>
          </div>
          <Link href="/planning" className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-card-foreground transition duration-200 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent/30">
            Volver a Planificación
          </Link>
        </div>
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          La interfaz del dashboard ya apunta aquí. La configuración real del presupuesto se podrá añadir después sin cambiar la navegación.
        </div>
      </section>
    </div>
  );
}
