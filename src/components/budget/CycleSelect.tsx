import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BILLING_PRESETS, PERIOD_UNITS, type BillingCycle, type PeriodUnit } from "@/lib/finance";
import { inputCls, triggerCls } from "./styles";

export type CycleValue = { billingCycle: BillingCycle; billingEvery?: number; billingUnit?: PeriodUnit };

/** Billing / crediting period: a preset, or "Custom" for every N days, weeks, months or years. */
export default function CycleSelect({ value, onChange }: { value: CycleValue; onChange: (v: CycleValue) => void }) {
  const custom = value.billingCycle === "custom";
  return (
    <div className="space-y-2">
      <Select
        value={value.billingCycle}
        onValueChange={(v) =>
          onChange(v === "custom" ? { billingCycle: "custom", billingEvery: value.billingEvery ?? 1, billingUnit: value.billingUnit ?? "months" } : { billingCycle: v as BillingCycle })
        }
      >
        <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
        <SelectContent>
          {BILLING_PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          <SelectItem value="custom">Custom…</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Every</span>
          <Input
            type="number" min="1" step="1" className={`${inputCls} w-20`}
            value={value.billingEvery ?? 1}
            onChange={(e) => onChange({ ...value, billingEvery: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
          />
          <Select value={value.billingUnit ?? "months"} onValueChange={(u) => onChange({ ...value, billingUnit: u as PeriodUnit })}>
            <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_UNITS.map((u) => <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
