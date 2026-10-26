"use client";

import Image from "next/image";
import { useState } from "react";
import { serviceBrand } from "@/lib/service-brands";
import { cn } from "@/lib/utils";

export function ServiceLogo({ name, className }: { name: string; className?: string }) {
  const brand = serviceBrand(name);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase("es");
  return <span className={cn("service-logo inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full", brand ? "bg-black" : "bg-muted text-sm font-semibold text-muted-foreground", className)} title={brand?.name ?? name}>
    {brand && failedSource !== brand.src
      ? <Image unoptimized src={brand.src} alt={`Logo de ${brand.name}`} width={64} height={64} className="h-full w-full object-contain" onError={() => setFailedSource(brand.src)} />
      : <span aria-label={name}>{initials || "?"}</span>}
  </span>;
}
