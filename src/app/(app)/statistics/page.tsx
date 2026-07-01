import { DashboardCharts } from "@/components/dashboard-charts";
import { getSessionUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/finance";

export default async function StatisticsPage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const data = await getDashboardData(session.user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Estadísticas</h1>
        <p className="text-sm text-muted-foreground">Evolución, categorías y comparativa mensual</p>
      </header>
      <DashboardCharts categories={data.charts.categories} monthly={data.charts.monthly} comparison={data.charts.comparison} />
    </div>
  );
}
