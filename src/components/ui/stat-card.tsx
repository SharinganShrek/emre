import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "text-primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-2">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-xl bg-surface-2",
              accent,
            )}
          >
            <Icon className="size-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
