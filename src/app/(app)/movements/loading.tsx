export default function MovementsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 h-10 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-2">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-md bg-muted/70" />)}
        </div>
      </div>
    </div>
  );
}