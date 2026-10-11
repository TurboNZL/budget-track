import type { LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { inputCls, labelCls } from "./styles";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className={labelCls}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/** Input with a leading icon or symbol (e.g. $) so the field's purpose reads at a glance. */
export function IconInput({
  icon: Icon, symbol, className, ...props
}: { icon?: LucideIcon; symbol?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      {Icon && <Icon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />}
      {symbol && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none text-sm">{symbol}</span>}
      <Input {...props} className={cn(inputCls, (Icon || symbol) && "pl-9", className)} />
    </div>
  );
}
