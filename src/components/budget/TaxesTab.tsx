import { useEffect, useState } from "react";
import { Banknote, Landmark, Pencil, Percent, Plus, Receipt, Save, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { databaseService, type Account, type TaxRule } from "@/lib/database";
import type { Rounding } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { useSettings } from "./useSettings";
import RoundingSelect from "./RoundingSelect";
import EntryDialog from "./EntryDialog";
import ConfirmDialog from "./ConfirmDialog";
import { Field, IconInput } from "./Field";
import Segmented from "./Segmented";
import IconButton from "./IconButton";
import { cardCls, triggerCls } from "./styles";

const ALL = "all";

type Form = { name: string; ratePct: string; base: TaxRule["base"]; accountId: number | null; incomeIsGross: boolean; rounding: Rounding; active: boolean };

export default function TaxesTab() {
  const { settings } = useSettings();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; editingId: number | null }>({ open: false, editingId: null });
  const [form, setForm] = useState<Form>({ name: "", ratePct: "", base: "interest", accountId: null, incomeIsGross: true, rounding: "nearest", active: true });
  const [deleting, setDeleting] = useState<TaxRule | null>(null);

  const load = async () => {
    const [a, r] = await Promise.all([databaseService.getAllAccounts(), databaseService.getAllTaxRules()]);
    setAccounts(a);
    setRules(r);
  };
  useEffect(() => {
    load().catch(() => showError("Failed to load tax rules"));
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const open = (rule?: TaxRule, preset?: "rwt" | "income") => {
    if (rule) {
      setForm({ name: rule.name, ratePct: String(rule.ratePct), base: rule.base, accountId: rule.accountId ?? null, incomeIsGross: rule.incomeIsGross, rounding: rule.rounding, active: rule.active });
    } else if (preset === "income") {
      setForm({ name: "Income tax", ratePct: "", base: "income", accountId: null, incomeIsGross: true, rounding: "nearest", active: true });
    } else {
      setForm({ name: "RWT", ratePct: String(settings.rwtRate), base: "interest", accountId: null, incomeIsGross: true, rounding: "nearest", active: true });
    }
    setDialog({ open: true, editingId: rule?.id ?? null });
  };

  const save = async () => {
    const rate = Number(form.ratePct);
    if (form.ratePct === "" || !(rate >= 0 && rate < 100)) return showError("Please enter a tax rate between 0 and 100");
    const data: Omit<TaxRule, "id"> = {
      name: form.name.trim() || "Tax", ratePct: rate, base: form.base, accountId: form.accountId ?? undefined,
      incomeIsGross: form.incomeIsGross, rounding: form.rounding, active: form.active,
    };
    try {
      if (dialog.editingId !== null) await databaseService.updateTaxRule(dialog.editingId, data);
      else await databaseService.addTaxRule(data);
      showSuccess(dialog.editingId !== null ? "Tax rule updated" : "Tax rule added");
      setDialog({ open: false, editingId: null });
      await load();
    } catch {
      showError("Failed to save the tax rule");
    }
  };

  const toggle = async (r: TaxRule, active: boolean) => {
    const { id, ...rest } = r;
    await databaseService.updateTaxRule(id, { ...rest, active });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button className="bg-primary text-primary-foreground" onClick={() => open(undefined, "rwt")}><Plus /> Add tax rule</Button>
        <Button variant="outline" onClick={() => open(undefined, "income")}><Banknote /> Tax on income</Button>
      </div>
      <Card className={cardCls}>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Tax rules are applied to an account's History through its timeline. <b>Interest tax</b> (like RWT) is taken off every interest credit; <b>income tax</b> is taken off each income transaction.
            The default RWT rate in Settings is {settings.rwtRate}%.
          </p>
          {rules.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Receipt className="w-9 h-9 mx-auto text-primary" />
              <p className="text-muted-foreground">No tax rules yet</p>
              <Button onClick={() => open(undefined, "rwt")}><Plus /> Add RWT on interest</Button>
            </div>
          ) : (
            <div className="bt-grid" style={{ ["--bt-col" as string]: "24rem" }}>
              {rules.map((r) => (
                <div key={r.id} onClick={() => open(r)}
                  className={cn("bt-row p-3 cursor-pointer space-y-2", !r.active && "opacity-60")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.base === "interest" ? "On interest earned" : `On income (${r.incomeIsGross ? "logged before tax" : "logged after tax"})`} · {r.accountId === undefined ? "every account" : accounts.find((a) => a.id === r.accountId)?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">rounds {r.rounding === "nearest" ? "to the nearest cent" : r.rounding}</div>
                    </div>
                    <div className="font-semibold tabular-nums">{r.ratePct}%</div>
                  </div>
                  <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={r.active} onCheckedChange={(v) => toggle(r, v)} aria-label={`${r.name} active`} />{r.active ? "Active" : "Paused"}
                    </label>
                    <div>
                      <IconButton icon={Pencil} label="Edit tax rule" onClick={() => open(r)} />
                      <IconButton icon={Trash2} tone="danger" label="Delete tax rule" onClick={() => setDeleting(r)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EntryDialog
        open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        icon={Receipt} title={dialog.editingId !== null ? "Edit tax rule" : "Add tax rule"}
        submitLabel={dialog.editingId !== null ? "Save changes" : "Add"} submitIcon={dialog.editingId !== null ? Save : Plus} onSubmit={save}
      >
        <Segmented label="Tax applies to" value={form.base} onChange={(b) => set("base", b)}
          options={[{ value: "interest", label: "Interest earned", icon: Percent }, { value: "income", label: "Income", icon: Banknote }]} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name"><IconInput data-autofocus icon={Receipt} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. RWT" /></Field>
          <Field label="Rate (%)"><IconInput type="number" step="0.1" min="0" value={form.ratePct} onChange={(e) => set("ratePct", e.target.value)} placeholder="10.5" /></Field>
          <Field label="Account">
            <Select value={form.accountId !== null ? String(form.accountId) : ALL} onValueChange={(v) => set("accountId", v === ALL ? null : Number(v))}>
              <SelectTrigger className={triggerCls}><Landmark className="w-4 h-4 mr-2 text-muted-foreground shrink-0" /><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Every account</SelectItem>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {form.base === "income" && (
            <Field label="Income I log is">
              <Segmented label="Income logged" compact value={form.incomeIsGross ? "gross" : "net"} onChange={(v) => set("incomeIsGross", v === "gross")}
                options={[{ value: "gross", label: "Before tax" }, { value: "net", label: "After tax" }]} />
            </Field>
          )}
        </div>
        <Field label="Rounding"><RoundingSelect value={form.rounding} onChange={(r) => set("rounding", r)} /></Field>
        <label className="flex items-center gap-2 text-sm text-foreground/80"><Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />{form.active ? "Active" : "Paused"}</label>
      </EntryDialog>

      <ConfirmDialog open={deleting !== null} title={`Delete "${deleting?.name}"?`} description="Its deductions disappear from account histories."
        onConfirm={async () => { if (deleting) { await databaseService.deleteTaxRule(deleting.id); setDeleting(null); await load(); } }} onCancel={() => setDeleting(null)} />
    </div>
  );
}
