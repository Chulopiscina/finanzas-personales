export default function Loading() {
  return <div role="status" aria-label="Cargando notificaciones" className="space-y-4"><div className="h-8 w-52 animate-pulse rounded bg-muted" />{[0, 1, 2].map((key) => <div key={key} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div>;
}
