"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onChange,
  className,
  label,
  color,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  label?: string;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-50",
        checked
          ? "border-transparent text-white"
          : "border-border-strong bg-surface-2 hover:border-muted-2",
        className,
      )}
      style={
        checked
          ? { backgroundColor: color ?? "var(--primary)" }
          : undefined
      }
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </button>
  );
}
