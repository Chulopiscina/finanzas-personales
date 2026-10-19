import { AdminPanel } from "@/components/admin-panel";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { getAdminStats } from "@/lib/finance";

export default async function AdminPage() {
  await requireAdmin();
  const data = await getAdminStats();

  return (
    <div className="space-y-6">
      <PageHeader title="Administración" description="Usuarios, actividad y estadísticas globales" />
      <AdminPanel data={data} />
    </div>
  );
}
