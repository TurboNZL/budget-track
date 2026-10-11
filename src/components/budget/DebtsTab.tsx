import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowDownLeft, ArrowUpRight, Calendar, Archive, ArchiveRestore, ChevronDown, ChevronUp, FileText, GraduationCap, HandCoins, Pencil, Plus, Save, Trash2, User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { databaseService, type Account, type Debt, type Transaction } from "@/lib/database";
import { CURRENCIES, formatMoney, toNZD, type Currency, type Rounding } from "@/lib/finance";
import { autoRepayments, withAutoRepayments } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { useSettings } from "./useSettings";
import { usePeople } from "./usePeople";
import PersonSelect from "./PersonSelect";
import EntryDialog from "./EntryDialog";
import ConfirmDialog from "./ConfirmDialog";
import RoundingSelect from "./RoundingSelect";
import { Field, IconInput } from "./Field";
import Segmented from "./Segmented";
import IconButton from "./IconButton";
import StatTile from "./StatTile";
import { cardCls, inputCls, labelCls, todayStr, triggerCls } from "./styles";

/** NZ student loan repayment threshold for the 2025-26 and 2026-27 tax years, and the 12% rate. */
const STUDENT_LOAN = { ratePct: 12, thresholdAnnual: 24128 };
const ANY_ACCOUNT = "any";

type AutoForm = {
  on: boolean;
  ratePct: string;
  thresholdAnnual: string;
  payFrequency: "weekly" | "fortnightly" | "monthly";
  incomeIsGross: boolean;
  accountId: number | null;
  startDate: string;
  rounding: Rounding;
};

type Form = {
  direction: Debt["direction"];
  name: string;
  personId: number | null;
  amount: string;
  currency: Currency;
  dateCreated: string;
  dueDate: string;
  notes: string;
  currentBalance: string;
  auto: AutoForm;
};

const emptyAuto = (): AutoForm => ({
  on: false, ratePct: String(STUDENT_LOAN.ratePct), thresholdAnnual: String(STUDENT_LOAN.thresholdAnnual), payFrequency: "fortnightly",
  incomeIsGross: false, accountId: null, startDate: todayStr(), rounding: "down",
});

const emptyForm = (): Form => ({
  direction: "owe", name: "", personId: null, amount: "", currency: "NZD", dateCreated: todayStr(),
  dueDate: "", notes: "", currentBalance: "", auto: emptyAuto(),
});

export default function DebtsTab() {
  const { settings } = useSettings();
  const rates = settings.exchangeRates;
  const { people, add: addPerson, nameOf } = usePeople();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState<Form>(emptyForm());
  const [dialog, setDialog] = useState<{ open: boolean; editingId: number | null }>({ open: false, editingId: null });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [repaying, setRepaying] = useState<Debt | null>(null);
  const [repayDate, setRepayDate] = useState(todayStr());
  const [repayAmount, setRepayAmount] = useState("");
  const [deleting, setDeleting] = useState<Debt | null>(null);
  const [showStale, setShowStale] = useState(false);

  const load = async () => {
    const [d, a, t] = await Promise.all([databaseService.getAllDebts(), databaseService.getAllAccounts(), databaseService.getAllTransactions()]);
    setDebts(d);
    setAccounts(a);
    setTransactions(t);
  };
  useEffect(() => {
    load().catch(() => showError("Failed to load debts"));
  }, []);

  const today = useMemo(() => new Date(), []);
  /** Debts with income-skimmed repayments (e.g. a student loan) already taken off the balance. */
  const effective = useMemo(() => withAutoRepayments(debts, transactions, today), [debts, transactions, today]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setAuto = <K extends keyof AutoForm>(key: K, value: AutoForm[K]) => setForm((f) => ({ ...f, auto: { ...f.auto, [key]: value } }));

  const active = useMemo(() => effective.filter((d) => !d.stale), [effective]);
  const staleDebts = useMemo(() => effective.filter((d) => d.stale), [effective]);

  const totals = useMemo(() => {
    const sum = (dir: Debt["direction"]) =>
      active.filter((d) => d.direction === dir).reduce((s, d) => s + toNZD(d.currentBalance, d.currency, rates), 0);
    const owe = sum("owe");
    const owed = sum("owed");
    return { owe, owed, net: owed - owe };
  }, [active, rates]);

  const openNew = (preset?: "student-loan") => {
    const f = emptyForm();
    setForm(f);
    setDialog({ open: true, editingId: null });
    if (preset === "student-loan") void applyStudentLoan(f);
  };

  const applyStudentLoan = async (base: Form = form) => {
    try {
      const personId = await addPerson("Loan provider");
      setForm({
        ...base, direction: "owe", name: "Student loan", personId, currency: "NZD",
        auto: { ...base.auto, on: true, ratePct: String(STUDENT_LOAN.ratePct), thresholdAnnual: String(STUDENT_LOAN.thresholdAnnual), incomeIsGross: false, rounding: "down" },
      });
    } catch {
      showError("Could not add the loan provider as a person");
    }
  };

  const openEdit = (debt: Debt) => {
    const a = debt.autoRepay;
    setForm({
      direction: debt.direction, name: debt.name, personId: debt.personId, amount: String(debt.amount), currency: debt.currency,
      dateCreated: debt.dateCreated, dueDate: debt.dueDate ?? "", notes: debt.notes ?? "", currentBalance: String(debt.currentBalance),
      auto: a
        ? { on: true, ratePct: String(a.ratePct), thresholdAnnual: String(a.thresholdAnnual), payFrequency: a.payFrequency, incomeIsGross: a.incomeIsGross, accountId: a.accountId ?? null, startDate: a.startDate, rounding: a.rounding }
        : emptyAuto(),
    });
    setDialog({ open: true, editingId: debt.id });
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!form.name.trim()) return showError("Please enter a name or description");
    if (form.personId === null) return showError("Please select the person");
    if (!(amount > 0)) return showError("Please enter a valid amount");
    const balance = form.currentBalance === "" ? amount : Number(form.currentBalance);
    if (!(balance >= 0)) return showError("Current balance cannot be negative");
    let autoRepay: Debt["autoRepay"];
    if (form.auto.on) {
      const rate = Number(form.auto.ratePct);
      const threshold = Number(form.auto.thresholdAnnual);
      if (!(rate >= 0 && rate < 100)) return showError("The repayment rate must be between 0 and 100");
      if (!(threshold >= 0)) return showError("The threshold cannot be negative");
      autoRepay = {
        ratePct: rate, thresholdAnnual: threshold, payFrequency: form.auto.payFrequency, incomeIsGross: form.auto.incomeIsGross,
        accountId: form.auto.accountId ?? undefined, startDate: form.auto.startDate || todayStr(), rounding: form.auto.rounding,
      };
    }
    const data = {
      direction: form.direction, name: form.name.trim(), personId: form.personId, amount, currency: form.currency,
      dateCreated: form.dateCreated || todayStr(), dueDate: form.dueDate || undefined, notes: form.notes.trim() || undefined,
      currentBalance: balance, autoRepay,
    };
    try {
      if (dialog.editingId !== null) await databaseService.updateDebt(dialog.editingId, data);
      else await databaseService.addDebt(data);
      showSuccess(dialog.editingId !== null ? "Debt updated" : "Debt added");
      setDialog({ open: false, editingId: null });
      await load();
    } catch {
      showError("Failed to save debt");
    }
  };

  const remove = async () => {
    if (!deleting) return;
    await databaseService.deleteDebt(deleting.id);
    setDeleting(null);
    await load();
    showSuccess("Debt deleted");
  };

  const toggleStale = async (debt: Debt) => {
    try {
      await databaseService.setDebtStale(debt.id, !debt.stale);
      await load();
      showSuccess(debt.stale ? "Debt is active again" : "Marked as stale. It no longer counts towards totals or graphs");
    } catch {
      showError("Failed to update the debt");
    }
  };

  const openRepay = (debt: Debt) => {
    setRepaying(debt);
    setRepayAmount("");
    setRepayDate(todayStr());
  };

  const saveRepayment = async () => {
    if (!repaying) return;
    const amount = Number(repayAmount);
    if (!(amount > 0)) return showError("Please enter a valid repayment amount");
    if (!repayDate) return showError("Please select a date");
    try {
      await databaseService.addRepayment(repaying.id, { date: repayDate, amount });
      setRepaying(null);
      await load();
      showSuccess("Repayment logged");
    } catch {
      showError("Failed to log repayment");
    }
  };

  const removeRepayment = async (debtId: number, repaymentId: number) => {
    await databaseService.deleteRepayment(debtId, repaymentId);
    await load();
  };

  const renderDebt = (debt: Debt) => {
    const raw = debts.find((d) => d.id === debt.id)!;
    const expanded = expandedId === debt.id;
    const settled = debt.currentBalance === 0;
    const paidPct = debt.amount > 0 ? Math.min(100, Math.max(0, ((debt.amount - debt.currentBalance) / debt.amount) * 100)) : 0;
    const auto = raw.autoRepay ? autoRepayments(raw, transactions, today) : null;
    const Icon = raw.autoRepay ? GraduationCap : debt.direction === "owe" ? ArrowUpRight : ArrowDownLeft;
    return (
      <div key={debt.id} className={cn("bt-row p-3 space-y-2", debt.stale && "opacity-70")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", debt.direction === "owe" ? "text-negative" : "text-positive")} />
            <div className="min-w-0">
              <div className="font-medium truncate">
                {debt.name} {settled && <span className="text-xs text-positive ml-1">Settled</span>}
                {debt.stale && <span className="text-xs text-muted-foreground ml-1">Stale</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {debt.direction === "owe" ? "Owed to" : "Owed by"} {nameOf(debt.personId)} · created {format(parseISO(debt.dateCreated), "d MMM yyyy")}
                {debt.dueDate && ` · due ${format(parseISO(debt.dueDate), "d MMM yyyy")}`}
              </div>
              {debt.notes && <div className="text-xs text-muted-foreground mt-1">{debt.notes}</div>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={cn("font-semibold tabular-nums", debt.direction === "owe" ? "text-negative" : "text-positive")}>{formatMoney(debt.currentBalance, debt.currency)}</div>
            <div className="text-xs text-muted-foreground">
              of {formatMoney(debt.amount, debt.currency)}
              {debt.currency !== "NZD" && ` · ≈ ${formatMoney(toNZD(debt.currentBalance, debt.currency, rates))}`}
            </div>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-background/60 overflow-hidden" role="progressbar" aria-valuenow={Math.round(paidPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Paid off">
          <div className="h-full bg-primary" style={{ width: `${paidPct}%` }} />
        </div>
        {raw.autoRepay && auto && (
          <div className="text-xs text-muted-foreground flex items-start gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
            <span>
              Skimmed off income automatically: {raw.autoRepay.ratePct}% above {formatMoney(raw.autoRepay.thresholdAnnual)}/year.
              {" "}{formatMoney(auto.total)} so far from {auto.entries.length} income {auto.entries.length === 1 ? "entry" : "entries"} since {format(parseISO(raw.autoRepay.startDate), "d MMM yyyy")}.
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={() => openRepay(raw)} disabled={settled}><HandCoins /> Log repayment</Button>
          <div>
            <IconButton icon={debt.stale ? ArchiveRestore : Archive} label={debt.stale ? "Mark as active again" : "Mark as stale (no longer a concern)"} onClick={() => toggleStale(raw)} />
            <IconButton icon={expanded ? ChevronUp : ChevronDown} label="Repayment history" onClick={() => setExpandedId(expanded ? null : debt.id)} />
            <IconButton icon={Pencil} label="Edit debt" onClick={() => openEdit(raw)} />
            <IconButton icon={Trash2} tone="danger" label="Delete debt" onClick={() => setDeleting(raw)} />
          </div>
        </div>
        {expanded && (
          <div className="border-t border-border pt-2 space-y-1 text-sm">
            {debt.repayments.length === 0 ? (
              <p className="text-muted-foreground">No repayments yet</p>
            ) : (
              [...debt.repayments].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                <div key={`${r.id}-${r.date}`} className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {format(parseISO(r.date), "d MMM yyyy")}{r.id < 0 && <span className="ml-2 text-xs text-primary">from income</span>}
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    {formatMoney(r.amount, debt.currency)}
                    {r.id > 0 && <IconButton icon={Trash2} tone="danger" label="Delete repayment" onClick={() => removeRepayment(debt.id, r.id)} className="h-6 w-6" />}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button className="bg-primary text-primary-foreground" onClick={() => openNew()}><Plus /> Add debt</Button>
        <Button variant="outline" onClick={() => openNew("student-loan")}><GraduationCap /> Add student loan</Button>
      </div>

      <div className="bt-tiles">
        <StatTile label="I owe (NZD)" icon={ArrowUpRight} tone="negative" value={formatMoney(totals.owe)} />
        <StatTile label="Owed to me (NZD)" icon={ArrowDownLeft} tone="positive" value={formatMoney(totals.owed)} />
        <StatTile label="Net (NZD)" icon={HandCoins} tone={totals.net < 0 ? "negative" : "positive"} value={formatMoney(totals.net)} />
      </div>

      <div className="bt-grid" style={{ ["--bt-col" as string]: "28rem" }}>
        {(["owe", "owed"] as const).map((dir) => {
          const list = active.filter((d) => d.direction === dir);
          return (
            <Card key={dir} className={cardCls}>
              <div className="p-5 pb-2 font-semibold leading-none tracking-tight space-y-1.5"><h3 className="text-xl">{dir === "owe" ? "Money I owe" : "Money owed to me"}</h3></div>
              <CardContent className="space-y-2">
                {list.length === 0 ? <p className="text-muted-foreground text-center py-4">Nothing here</p> : list.map(renderDebt)}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {staleDebts.length > 0 && (
        <Card className={cardCls}>
          <div className="p-5 pb-2 flex items-center justify-between gap-2">
            <div className="space-y-1.5 font-semibold leading-none tracking-tight"><h3 className="text-xl">Stale debts</h3></div>
            <Button size="sm" variant="outline" onClick={() => setShowStale((v) => !v)}>{showStale ? "Hide" : `Show ${staleDebts.length}`}</Button>
          </div>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Debts you have marked as no longer a concern. They are left out of the totals above and the graphs.</p>
            {showStale && <div className="bt-grid" style={{ ["--bt-col" as string]: "28rem" }}>{staleDebts.map(renderDebt)}</div>}
          </CardContent>
        </Card>
      )}

      <EntryDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        icon={HandCoins}
        title={dialog.editingId !== null ? "Edit debt" : "Add debt"}
        submitLabel={dialog.editingId !== null ? "Save changes" : "Add"}
        submitIcon={dialog.editingId !== null ? Save : Plus}
        onSubmit={save}
        wide
        footerStart={
          dialog.editingId === null && !form.auto.on ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => applyStudentLoan()}><GraduationCap /> Use student loan preset</Button>
          ) : undefined
        }
      >
        <Segmented
          label="Direction" value={form.direction} onChange={(v) => set("direction", v)}
          options={[
            { value: "owe", label: "I owe", icon: ArrowUpRight, hint: "A liability: I owe them" },
            { value: "owed", label: "Owed to me", icon: ArrowDownLeft, hint: "An asset: they owe me" },
          ]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name / description"><IconInput icon={FileText} data-autofocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Loan for phone purchase" /></Field>
          <Field label="Person"><PersonSelect people={people} value={form.personId} onChange={(id) => set("personId", id)} onAdd={addPerson} /></Field>
          <Field label="Original amount">
            <div className="flex gap-2">
              <IconInput symbol="$" type="number" inputMode="decimal" step="0.01" min="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" />
              <Select value={form.currency} onValueChange={(v) => set("currency", v as Currency)}>
                <SelectTrigger className={`${triggerCls} w-24`} aria-label="Currency"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </Field>
          <Field label={form.auto.on ? "Balance on the date below" : "Current balance"} hint="Leave blank to use the original amount.">
            <IconInput symbol="$" type="number" inputMode="decimal" step="0.01" min="0" value={form.currentBalance} onChange={(e) => set("currentBalance", e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Date created"><IconInput icon={Calendar} type="date" value={form.dateCreated} onChange={(e) => set("dateCreated", e.target.value)} /></Field>
          <Field label="Due date (optional)"><IconInput icon={Calendar} type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
        </div>
        <Field label="Notes (optional)"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inputCls} rows={2} /></Field>

        <div className="bt-row p-3 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <Switch checked={form.auto.on} onCheckedChange={(v) => setAuto("on", v)} className="mt-0.5" aria-label="Taken off my income automatically" />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-medium"><GraduationCap className="w-4 h-4 text-primary" />Taken off my income automatically</span>
              <span className="text-muted-foreground">For loans like a student loan that are skimmed off pay. Each income transaction reduces the balance, so you never log repayments by hand.</span>
            </span>
          </label>
          {form.auto.on && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Repayment rate (%)"><IconInput type="number" step="0.1" min="0" value={form.auto.ratePct} onChange={(e) => setAuto("ratePct", e.target.value)} /></Field>
              <Field label="Yearly threshold" hint="Nothing is taken below this income. NZ default: $24,128 a year (12%)."><IconInput symbol="$" type="number" step="1" min="0" value={form.auto.thresholdAnnual} onChange={(e) => setAuto("thresholdAnnual", e.target.value)} /></Field>
              <Field label="I'm paid">
                <Segmented label="Pay frequency" compact value={form.auto.payFrequency} onChange={(v) => setAuto("payFrequency", v)}
                  options={[{ value: "weekly", label: "Weekly" }, { value: "fortnightly", label: "Fortnightly" }, { value: "monthly", label: "Monthly" }]} />
              </Field>
              <Field label="Income I log is">
                <Segmented label="Income logged" compact value={form.auto.incomeIsGross ? "gross" : "net"} onChange={(v) => setAuto("incomeIsGross", v === "gross")}
                  options={[{ value: "net", label: "Take-home", hint: "After the deduction" }, { value: "gross", label: "Before deduction" }]} />
              </Field>
              <Field label="Counts income from">
                <Select value={form.auto.accountId !== null ? String(form.auto.accountId) : ANY_ACCOUNT} onValueChange={(v) => setAuto("accountId", v === ANY_ACCOUNT ? null : Number(v))}>
                  <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_ACCOUNT}>Every account</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Balance is correct as of"><IconInput icon={Calendar} type="date" value={form.auto.startDate} onChange={(e) => setAuto("startDate", e.target.value)} /></Field>
              <div className="sm:col-span-2">
                <Label2>Rounding</Label2>
                <RoundingSelect value={form.auto.rounding} onChange={(r) => setAuto("rounding", r)} />
              </div>
            </div>
          )}
        </div>
      </EntryDialog>

      <EntryDialog
        open={repaying !== null}
        onOpenChange={(o) => !o && setRepaying(null)}
        icon={HandCoins}
        title={repaying ? `Log repayment: ${repaying.name}` : "Log repayment"}
        submitLabel="Log repayment"
        onSubmit={saveRepayment}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={`Amount (${repaying?.currency ?? "NZD"})`}>
            <IconInput symbol="$" data-autofocus type="number" inputMode="decimal" step="0.01" min="0.01" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} placeholder="0.00" className="text-lg font-semibold tabular-nums" />
            {repaying && (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs mt-1.5" onClick={() => setRepayAmount(String(effective.find((d) => d.id === repaying.id)?.currentBalance ?? repaying.currentBalance))}>
                Pay off in full
              </Button>
            )}
          </Field>
          <Field label="Date"><IconInput icon={Calendar} type="date" value={repayDate} onChange={(e) => setRepayDate(e.target.value)} /></Field>
        </div>
      </EntryDialog>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.name}"?`}
        description="Its repayment history is deleted with it."
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function Label2({ children }: { children: React.ReactNode }) {
  return <span className={labelCls}>{children}</span>;
}
