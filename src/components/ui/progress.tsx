import { cn } from "@/lib/utils";
import { clamp } from "@/lib/utils";

export function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const v = clamp(value);
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-surface-2",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-all duration-500",
          barClassName,
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
