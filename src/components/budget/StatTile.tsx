import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatTile({
  label, value, icon: Icon, tone, sub,
}: { label: string; value: React.ReactNode; icon?: LucideIcon; tone?: "positive" | "negative"; sub?: React.ReactNode }) {
  return (
    <div className="bt-tile p-4">
      <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="truncate">{label}</span>
        {Icon && <Icon className={cn("w-4 h-4 shrink-0", tone === "positive" && "text-positive", tone === "negative" && "text-negative")} />}
      </div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", tone === "positive" && "text-positive", tone === "negative" && "text-negative")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
