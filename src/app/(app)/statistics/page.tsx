import { DashboardChartsLazy } from "@/components/dashboard-charts-lazy";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { getDashboardData } from "@/lib/finance";

export default async function StatisticsPage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const data = await getDashboardData(session.user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Estadísticas" description="Entiende tus hábitos y cómo evoluciona tu dinero." />
      <DashboardChartsLazy categories={data.charts.categories} monthly={data.charts.monthly} comparison={data.charts.comparison} />
    </div>
  );
}
