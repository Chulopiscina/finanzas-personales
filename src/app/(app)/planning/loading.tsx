export default function PlanningLoading() {
  return (
    <div className="space-y-5">
      <div className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />)}
      </div>
    </div>
  );
}