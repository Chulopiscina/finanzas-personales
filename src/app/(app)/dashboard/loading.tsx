export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-60 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-60 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </div>
  );
}