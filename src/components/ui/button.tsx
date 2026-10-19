"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      aria-label={props["aria-label"] ?? props.title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
        variant === "primary" &&
          "border-accent bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 active:bg-accent/80",
        variant === "secondary" &&
          "border-border bg-card text-card-foreground hover:bg-muted",
        variant === "ghost" &&
          "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" &&
          "border-danger/30 bg-danger/10 text-danger hover:bg-danger/15",
        size === "sm" && "h-8 px-3",
        size === "md" && "h-10 px-4",
        size === "icon" && "h-10 w-10 p-0",
        className
      )}
      {...props}
    />
  );
}
