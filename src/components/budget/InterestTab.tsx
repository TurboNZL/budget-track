import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Calculator, Calendar, Landmark, Pencil, Percent, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { databaseService, type Account, type InterestBasis, type InterestCalculation, type InterestRule } from "@/lib/database";
import {
  COMPOUNDING_OPTIONS, PERIOD_UNITS, calcInterest, cycleLabel, formatMoney, impliedRatePct, periodToYears, roundMoney,
  type Compounding, type PeriodUnit, type Rounding,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
import { useSettings } from "./useSettings";
import CycleSelect, { type CycleValue } from "./CycleSelect";
import RoundingSelect from "./RoundingSelect";
import EntryDialog from "./EntryDialog";
import ConfirmDialog from "./ConfirmDialog";
import { Field, IconInput } from "./Field";
import Segmented from "./Segmented";
import IconButton from "./IconButton";
import { cardCls, inputCls, labelCls, primaryBtnCls, todayStr, triggerCls } from "./styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Result = Omit<InterestCalculation, "id" | "createdAt">;

const fmtPct = (n: number) => `${n.toFixed(4).replace(/\.?0+$/, "")}%`;

type RuleForm = { name: string; accountId: number | null; ratePct: string; cycle: CycleValue; startDate: string; applyTax: boolean; rounding: Rounding; active: boolean };
const emptyRule = (accountId: number | null, basis: InterestBasis = "monthly"): RuleForm => ({
  name: "", accountId, ratePct: "", cycle: { billingCycle: basis === "yearly" ? "annual" : "monthly" }, startDate: todayStr(), applyTax: true, rounding: "down", active: true,
});

function RulesCard({ basis }: { basis: InterestBasis }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState<InterestRule[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; editingId: number | null }>({ open: false, editingId: null });
  const [form, setForm] = useState<RuleForm>(emptyRule(null));
  const [deleting, setDeleting] = useState<InterestRule | null>(null);

  const load = async () => {
    const [a, r] = await Promise.all([databaseService.getAllAccounts(), databaseService.getAllInterestRules()]);
    setAccounts(a);
    setRules(r);
  };
  useEffect(() => {
    load().catch(() => showError("Failed to load interest rules"));
  }, []);

  const set = <K extends keyof RuleForm>(k: K, v: RuleForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const open = (rule?: InterestRule) => {
    setForm(
      rule
        ? { name: rule.name, accountId: rule.accountId, ratePct: String(rule.ratePct), cycle: { billingCycle: rule.billingCycle, billingEvery: rule.billingEvery, billingUnit: rule.billingUnit }, startDate: rule.startDate, applyTax: rule.applyTax, rounding: rule.rounding, active: rule.active }
        : emptyRule(accounts.length === 1 ? accounts[0].id : null, basis)
    );
    setDialog({ open: true, editingId: rule?.id ?? null });
  };

  const save = async () => {
    const rate = Number(form.ratePct);
    if (form.accountId === null) return showError("Please choose an account");
    if (form.ratePct === "" || !Number.isFinite(rate) || rate < 0) return showError("Please enter the yearly interest rate");
    const data: Omit<InterestRule, "id"> = {
      name: form.name.trim() || "Interest", accountId: form.accountId, ratePct: rate, ...form.cycle,
      startDate: form.startDate || todayStr(), applyTax: form.applyTax, rounding: form.rounding, active: form.active,
    };
    try {
      if (dialog.editingId !== null) await databaseService.updateInterestRule(dialog.editingId, data);
      else await databaseService.addInterestRule(data);
      showSuccess(dialog.editingId !== null ? "Interest rule updated" : "Interest rule added");
      setDialog({ open: false, editingId: null });
      await load();
    } catch {
      showError("Failed to save the interest rule");
    }
  };

  const toggle = async (r: InterestRule, active: boolean) => {
    const { id, ...rest } = r;
    await databaseService.updateInterestRule(id, { ...rest, active });
    await load();
  };

  return (
    <Card className={cardCls}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><Percent className="w-5 h-5 text-primary" />Account interest</CardTitle>
        <Button size="sm" className={primaryBtnCls} onClick={() => open()} disabled={accounts.length === 0}><Plus /> Add</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Interest an account earns. Rules are applied to the account's History through its timeline, with tax taken off each credit by your Taxes rules.
        </p>
        {accounts.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Add an account first</p>
        ) : rules.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No interest rules yet</p>
        ) : (
          rules.map((r) => (
            <div key={r.id} onClick={() => open(r)}
              className={cn("bt-row p-3 cursor-pointer space-y-2", !r.active && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {accounts.find((a) => a.id === r.accountId)?.name} · credited {cycleLabel(r).toLowerCase()} · from {format(parseISO(r.startDate), "d MMM yyyy")}
                  </div>
                  <div className="text-xs text-muted-foreground">{r.applyTax ? "Tax rules apply" : "No tax"} · rounds {r.rounding === "nearest" ? "to the nearest cent" : r.rounding}</div>
                </div>
                <div className="font-semibold tabular-nums">{fmtPct(r.ratePct)} <span className="text-xs text-muted-foreground font-normal">a year</span></div>
              </div>
              <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={r.active} onCheckedChange={(v) => toggle(r, v)} aria-label={`${r.name} active`} />{r.active ? "Active" : "Paused"}
                </label>
                <div>
                  <IconButton icon={Pencil} label="Edit interest rule" onClick={() => open(r)} />
                  <IconButton icon={Trash2} tone="danger" label="Delete interest rule" onClick={() => setDeleting(r)} />
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <EntryDialog
        open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        icon={Percent} title={dialog.editingId !== null ? "Edit interest rule" : "Add interest rule"}
        submitLabel={dialog.editingId !== null ? "Save changes" : "Add"} submitIcon={dialog.editingId !== null ? Save : Plus} onSubmit={save} wide
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name"><IconInput data-autofocus icon={Percent} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Savings interest" /></Field>
          <Field label="Account">
            <Select value={form.accountId !== null ? String(form.accountId) : ""} onValueChange={(v) => set("accountId", Number(v))}>
              <SelectTrigger className={triggerCls}><Landmark className="w-4 h-4 mr-2 text-muted-foreground shrink-0" /><SelectValue placeholder="Choose account" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Interest rate (% a year)"><IconInput type="number" step="0.01" min="0" value={form.ratePct} onChange={(e) => set("ratePct", e.target.value)} placeholder="e.g. 4.5" /></Field>
          <Field label="Credited"><CycleSelect value={form.cycle} onChange={(c) => set("cycle", c)} /></Field>
          <Field label="Interest starts" hint="The first credit lands one period after this day."><IconInput icon={Calendar} type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
          <Field label="Rounding" hint="Banks usually round interest down."><RoundingSelect value={form.rounding} onChange={(r) => set("rounding", r)} /></Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-foreground/80"><Switch checked={form.applyTax} onCheckedChange={(v) => set("applyTax", v)} />Take tax off each credit (RWT etc.)</label>
          <label className="flex items-center gap-2 text-sm text-foreground/80"><Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />{form.active ? "Active" : "Paused"}</label>
        </div>
      </EntryDialog>

      <ConfirmDialog open={deleting !== null} title={`Delete "${deleting?.name}"?`} description="Interest credits from this rule disappear from the account history."
        onConfirm={async () => { if (deleting) { await databaseService.deleteInterestRule(deleting.id); setDeleting(null); await load(); } }} onCancel={() => setDeleting(null)} />
    </Card>
  );
}

export default function InterestTab() {
  const { settings } = useSettings();
  const [mode, setMode] = useState<"forward" | "reverse">("forward");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [balanceAfter, setBalanceAfter] = useState("");
  const [periodValue, setPeriodValue] = useState("1");
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>("months");
  const [compounding, setCompounding] = useState<Compounding>("simple");
  const [applyTax, setApplyTax] = useState(true);
  const [taxRate, setTaxRate] = useState("10.5");
  const [rounding, setRounding] = useState<Rounding>("nearest");
  const [balanceIsPostTax, setBalanceIsPostTax] = useState(false);
  const [history, setHistory] = useState<InterestCalculation[]>([]);

  useEffect(() => {
    setTaxRate(String(settings.rwtRate));
  }, [settings.rwtRate]);

  // The default period follows the interest basis in Settings (monthly unless switched to yearly)
  useEffect(() => {
    setPeriodUnit(settings.interestBasis === "yearly" ? "years" : "months");
  }, [settings.interestBasis]);

  const loadHistory = async () => setHistory(await databaseService.getInterestHistory());
  useEffect(() => {
    loadHistory().catch(() => showError("Failed to load calculation history"));
  }, []);

  const result: Result | null = useMemo(() => {
    const p = Number(principal);
    const pv = Number(periodValue);
    const tr = Number(taxRate);
    const years = periodToYears(pv, periodUnit);
    if (!(p > 0) || !(pv > 0) || principal === "" || (applyTax && !(tr >= 0 && tr < 100))) return null;
    const taxFraction = applyTax ? tr / 100 : 0;
    const base = { mode, principal: p, periodValue: pv, periodUnit, compounding, applyTax, taxRate: tr, rounding };
    const finish = (ratePct: number, grossRaw: number): Result => {
      const gross = roundMoney(grossRaw, rounding);
      const tax = gross > 0 ? roundMoney(gross * taxFraction, rounding) : 0;
      return { ...base, ratePct, grossInterest: gross, tax, netInterest: gross - tax, finalBalance: p + gross - tax };
    };

    if (mode === "forward") {
      if (rate === "" || !Number.isFinite(Number(rate))) return null;
      const r = Number(rate);
      return finish(r, calcInterest(p, r, years, compounding));
    }

    const b = Number(balanceAfter);
    if (balanceAfter === "" || !(b > 0)) return null;
    // If the balance entered is after tax, gross it back up to find the pre-tax interest.
    const gross = applyTax && balanceIsPostTax ? (b - p) / (1 - taxFraction) : b - p;
    const impliedRate = impliedRatePct(p, p + gross, years, compounding);
    if (impliedRate === null) return null;
    return finish(impliedRate, gross);
  }, [mode, principal, rate, balanceAfter, periodValue, periodUnit, compounding, applyTax, taxRate, balanceIsPostTax, rounding]);

  const save = async () => {
    if (!result) return;
    try {
      await databaseService.addInterestCalculation(result);
      await loadHistory();
      showSuccess("Calculation saved to history");
    } catch {
      showError("Failed to save calculation");
    }
  };

  const remove = async (id: number) => {
    await databaseService.deleteInterestCalculation(id);
    await loadHistory();
  };

  const row = (label: string, value: string, strong = false) => (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-bold text-lg" : "font-medium"}>{value}</span>
    </div>
  );

  return (
    <div className="bt-grid" style={{ ["--bt-col" as string]: "30rem" }}>
      <RulesCard basis={settings.interestBasis} />

      <Card className={cardCls}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5 text-primary" />Interest calculator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Segmented label="Calculator mode" value={mode} onChange={(v) => setMode(v as typeof mode)}
            options={[{ value: "forward", label: "Calculate interest", icon: Calculator }, { value: "reverse", label: "Find the rate", icon: Percent }]} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Principal balance"><IconInput symbol="$" type="number" step="0.01" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="0.00" /></Field>
            {mode === "forward" ? (
              <Field label="Annual interest rate (%)"><IconInput type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 4.5" /></Field>
            ) : (
              <Field label="Balance after interest"><IconInput symbol="$" type="number" step="0.01" min="0" value={balanceAfter} onChange={(e) => setBalanceAfter(e.target.value)} placeholder="0.00" /></Field>
            )}
            <Field label="Compounding">
              <Select value={compounding} onValueChange={(v) => setCompounding(v as Compounding)}>
                <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
                <SelectContent>{COMPOUNDING_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Period">
              <div className="flex gap-2">
                <Input type="number" step="any" min="0" value={periodValue} onChange={(e) => setPeriodValue(e.target.value)} className={`${inputCls} w-24`} />
                <Select value={periodUnit} onValueChange={(v) => setPeriodUnit(v as PeriodUnit)}>
                  <SelectTrigger className={`${triggerCls} capitalize`}><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIOD_UNITS.map((u) => <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Field>
          </div>
          <Field label="Rounding"><RoundingSelect value={rounding} onChange={setRounding} /></Field>

          <div className="flex flex-wrap items-end gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <Checkbox checked={applyTax} onCheckedChange={(c) => setApplyTax(c === true)} />Apply RWT
            </label>
            {applyTax && (
              <div className="w-40">
                <Label className={labelCls}>RWT rate (%)</Label>
                <Input type="number" step="0.1" min="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className={inputCls} />
              </div>
            )}
            {mode === "reverse" && applyTax && (
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <Checkbox checked={balanceIsPostTax} onCheckedChange={(c) => setBalanceIsPostTax(c === true)} />Balance after is post-tax
              </label>
            )}
          </div>

          <div className="bt-tile p-4">
            {result ? (
              <>
                {mode === "reverse" && row("Annual interest rate", fmtPct(result.ratePct), true)}
                {row("Interest earned" + (result.applyTax ? " (before tax)" : ""), formatMoney(result.grossInterest), mode === "forward" && !result.applyTax)}
                {result.applyTax && (<>{row(`RWT at ${result.taxRate}%`, `-${formatMoney(result.tax)}`)}{row("Interest after tax", formatMoney(result.netInterest))}</>)}
                {row("Final balance", formatMoney(result.finalBalance), true)}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Enter valid values to see the result.</p>
            )}
          </div>
          <div className="flex justify-end"><Button className={primaryBtnCls} onClick={save} disabled={!result}><Save /> Save to history</Button></div>
        </CardContent>
      </Card>

      <Card className={`${cardCls} bt-span`}>
        <CardHeader><CardTitle>Calculation history</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No saved calculations</p>
          ) : (
            <div className="bt-grid" style={{ ["--bt-col" as string]: "22rem" }}>
              {history.map((c) => (
                <div key={c.id} className="bt-row p-3 text-sm flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {formatMoney(c.principal)} at {fmtPct(c.ratePct)} for {c.periodValue} {c.periodUnit}
                      {c.mode === "reverse" && <span className="text-xs text-primary ml-2">reverse</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(c.createdAt), "d MMM yyyy HH:mm")} · {c.compounding}{c.applyTax && ` · RWT ${c.taxRate}%`}
                    </div>
                    <div className="text-xs mt-1">Interest {formatMoney(c.netInterest)} · Balance {formatMoney(c.finalBalance)}</div>
                  </div>
                  <IconButton icon={Trash2} tone="danger" label="Delete calculation" onClick={() => remove(c.id)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
