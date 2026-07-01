import { AdminPanel } from "@/components/admin-panel";
import { requireAdmin } from "@/lib/auth";
import { getAdminStats } from "@/lib/finance";

export default async function AdminPage() {
  await requireAdmin();
  const data = await getAdminStats();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Administración</h1>
        <p className="text-sm text-muted-foreground">Usuarios, actividad y estadísticas globales</p>
      </header>
      <AdminPanel data={data} />
    </div>
  );
}
