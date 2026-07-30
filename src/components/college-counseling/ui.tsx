import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export function CollegeStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-2">
          {label}
        </p>
        <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function CounselingSectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function statusBadgeVariant(
  status: string,
): BadgeProps["variant"] {
  const s = status.toLowerCase();
  if (s.includes("ready") || s === "done" || s === "submitted" || s === "shared")
    return "success";
  if (s.includes("revision") || s.includes("progress") || s === "asked")
    return "warning";
  if (s.includes("blocked") || s.includes("poor") || s.includes("extreme"))
    return "danger";
  if (s.includes("high")) return "accent";
  return "default";
}

export function MetaRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1 sm:grid-cols-[140px_1fr]", className)}>
      <dt className="text-xs font-medium text-muted-2">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const variant =
    priority === "high" ? "danger" : priority === "medium" ? "warning" : "default";
  return (
    <Badge variant={variant} className="capitalize">
      {priority}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusBadgeVariant(status)} className="capitalize">
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
