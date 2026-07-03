import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  caption,
  icon: Icon,
  tone = "neutral",
  emphasis = false,
  className
}: {
  title: string;
  value: string;
  caption?: string;
  icon: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "danger";
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-4 shadow-sm", emphasis && "bg-muted/30", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
          <p className={cn("mt-2 truncate font-semibold tracking-normal text-card-foreground", emphasis ? "text-3xl" : "text-2xl")}>
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
            tone === "neutral" && "border-border bg-muted text-muted-foreground",
            tone === "success" && "border-success/25 bg-success/10 text-success",
            tone === "warning" && "border-warning/25 bg-warning/10 text-warning",
            tone === "danger" && "border-danger/25 bg-danger/10 text-danger"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {caption ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{caption}</p> : null}
    </section>
  );
}
