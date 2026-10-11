import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: string; icon?: LucideIcon; hint?: string };

/** A row of mutually exclusive choices with icons: one click to pick, no dropdown to open. */
export default function Segmented<T extends string>({
  value, onChange, options, label, className, compact,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("bt-seg flex w-full gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            title={o.hint ?? o.label}
            onClick={() => onChange(o.value)}
            className={cn(
              "bt-seg-item flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors",
              compact ? "py-1.5" : "py-2",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
