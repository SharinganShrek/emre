"use client";

import type { ReactNode } from "react";
import { useHub } from "@/lib/store";
import { Skeleton } from "@/components/ui/states";

/**
 * Renders children only after the client store has hydrated from localStorage.
 * This keeps server and first client render identical (both show the skeleton),
 * avoiding hydration mismatches from time-based seed data.
 */
export function Hydrated({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { ready } = useHub();
  if (!ready) {
    return (
      fallback ?? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-56" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )
    );
  }
  return <>{children}</>;
}
