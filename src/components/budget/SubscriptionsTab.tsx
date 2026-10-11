import { useEffect, useMemo, useState } from "react";
import { addMonths, addYears, format, parseISO } from "date-fns";
import { Calendar, CalendarClock, Check, FileText, HandCoins, Landmark, Pencil, Plus, Repeat, Save, Trash2, User, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { databaseService, type Account, type Subscription, type SubscriptionKind } from "@/lib/database";
import {
  CURRENCIES, cycleLabel, formatMoney, getOccurrences, monthlyAmountNZD, toNZD, type Currency, type Rounding,
} from "@/lib/finance";
import { subscriptionFlow, SUBSCRIPTION_KIND_LABEL } from "@/lib/subscriptionFlow";
import { cn } from "@/lib/utils";
import { useSettings } from "./useSettings";
import { usePeople } from "./usePeople";
import { useCategories } from "./useCategories";
import PersonSelect from "./PersonSelect";
import CategorySelect from "./CategorySelect";
import CycleSelect, { type CycleValue } from "./CycleSelect";
import RoundingSelect from "./RoundingSelect";
import EntryDialog from "./EntryDialog";
import ConfirmDialog from "./ConfirmDialog";
import { Field, IconInput } from "./Field";
import Segmented from "./Segmented";
import IconButton from "./IconButton";
import StatTile from "./StatTile";
import { cardCls, inputCls, todayStr, triggerCls } from "./styles";

const NO_ACCOUNT = "none";

type Form = {
  name: string;
  amount: string;
  currency: Currency;
  cycle: CycleValue;
  startDate: string;
  category: string;
  active: boolean;
  kind: SubscriptionKind;
  personId: number | null;
  paidByMe: boolean;
  accountId: number | null;
  rounding: Rounding;
};

const emptyForm = (): Form => ({
  name: "", amount: "", currency: "NZD", cycle: { billingCycle: "monthly" }, startDate: todayStr(), category: "",
  active: true, kind: "own", personId: null, paidByMe: true, accountId: null, rounding: "nearest",
});

const KIND_ICON = { own: User, other: Users, loan: HandCoins } as const;

export default function SubscriptionsTab() {
  const { settings } = useSettings();
  const rates = settings.exchangeRates;
  const { people, add: addPerson, nameOf } = usePeople();
  const { categories, add: addCategory } = useCategories();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; editingId: number | null }>({ open: false, editingId: null });
  const [form, setForm] = useState<Form>(emptyForm());
  const [deleting, setDeleting] = useState<Subscription | null>(null);

  // Projection tool
  const [targetDate, setTargetDate] = useState(() => format(addMonths(new Date(), 3), "yyyy-MM-dd"));
  const [unticked, setUnticked] = useState<Set<string>>(new Set());

  const load = async () => {
    const [list, accs] = await Promise.all([databaseService.getAllSubscriptions(), databaseService.getAllAccounts()]);
    setSubs(list);
    setAccounts(accs);
  };
  useEffect(() => {
    load().catch(() => showError("Failed to load subscriptions"));
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openNew = () => {
    setForm(emptyForm());
    setDialog({ open: true, editingId: null });
  };
  const openEdit = (sub: Subscription) => {
    setForm({
      name: sub.name, amount: String(sub.amount), currency: sub.currency,
      cycle: { billingCycle: sub.billingCycle, billingEvery: sub.billingEvery, billingUnit: sub.billingUnit },
      startDate: sub.startDate, category: sub.category, active: sub.active, kind: sub.kind,
      personId: sub.personId ?? null, paidByMe: sub.paidByMe, accountId: sub.accountId ?? null, rounding: sub.rounding,
    });
    setDialog({ open: true, editingId: sub.id });
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!form.name.trim()) return showError("Please enter a name");
    if (!(amount > 0)) return showError("Please enter a valid amount");
    if (!form.startDate) return showError("Please select a start date");
    if (form.kind !== "own" && form.personId === null) {
      return showError(form.kind === "loan" ? "Please select who the loan is with" : "Please select whose subscription it is");
    }
    const paidByMe = form.kind === "own" ? true : form.paidByMe;
    const hasAccount = form.kind !== "other" || paidByMe;
    const data: Omit<Subscription, "id"> = {
      name: form.name.trim(), amount, currency: form.currency, ...form.cycle, startDate: form.startDate,
      category: form.category, active: form.active, kind: form.kind, paidByMe,
      personId: form.kind === "own" ? undefined : form.personId ?? undefined,
      accountId: hasAccount ? form.accountId ?? undefined : undefined,
      rounding: form.rounding,
    };
    try {
      if (dialog.editingId !== null) await databaseService.updateSubscription(dialog.editingId, data);
      else await databaseService.addSubscription(data);
      showSuccess(dialog.editingId !== null ? "Subscription updated" : "Subscription added");
      setDialog({ open: false, editingId: null });
      await load();
    } catch {
      showError("Failed to save subscription");
    }
  };

  const toggleActive = async (sub: Subscription, active: boolean) => {
    const { id, ...rest } = sub;
    await databaseService.updateSubscription(id, { ...rest, active });
    await load();
  };

  const remove = async () => {
    if (!deleting) return;
    await databaseService.deleteSubscription(deleting.id);
    setDeleting(null);
    await load();
    showSuccess("Subscription deleted");
  };

  // Per month: what I spend on subscriptions, and net money moving through recurring loans
  const monthly = useMemo(() => {
    let spend = 0;
    let loans = 0;
    for (const s of subs.filter((x) => x.active)) {
      const flow = subscriptionFlow(s);
      const amount = monthlyAmountNZD(s.amount, s.currency, s, rates);
      if (s.kind === "loan") loans += -flow * amount;
      else if (flow === -1) spend += amount;
    }
    return { spend, loans };
  }, [subs, rates]);

  const projected = useMemo(() => {
    if (!targetDate) return [];
    const target = parseISO(targetDate);
    const today = new Date();
    if (target < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return [];
    return subs
      .filter((s) => s.active && subscriptionFlow(s) !== 0)
      .flatMap((sub) =>
        getOccurrences(sub.startDate, sub, today, target).map((date) => ({ key: `${sub.id}|${format(date, "yyyy-MM-dd")}`, sub, date }))
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [subs, targetDate]);

  const selectedRows = projected.filter((r) => !unticked.has(r.key));
  const projectedTotal = selectedRows.reduce((sum, r) => sum - subscriptionFlow(r.sub) * toNZD(r.sub.amount, r.sub.currency, rates), 0);
  const toggleRow = (key: string, checked: boolean) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(key);
      else next.add(key);
      return next;
    });

  const setHorizon = (months: number) => setTargetDate(format(months === 12 ? addYears(new Date(), 1) : addMonths(new Date(), months), "yyyy-MM-dd"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button className="bg-primary text-primary-foreground" onClick={openNew}><Plus /> Add subscription</Button>
      </div>

      <div className="bt-tiles">
        <StatTile label="My subscriptions / month" icon={Repeat} value={formatMoney(monthly.spend)} sub="approx., in NZD" />
        {monthly.loans !== 0 && (
          <StatTile
            label="Loans / month" icon={HandCoins}
            tone={monthly.loans > 0 ? "negative" : "positive"}
            value={formatMoney(Math.abs(monthly.loans))} sub={monthly.loans > 0 ? "paying out" : "receiving"}
          />
        )}
        <StatTile label="Active" icon={Check} value={`${subs.filter((s) => s.active).length} of ${subs.length}`} />
      </div>

      <div className="bt-grid" style={{ ["--bt-col" as string]: "24rem" }}>
        {subs.length === 0 ? (
          <Card className={cn(cardCls, "bt-span text-center")}>
            <CardContent className="py-10 space-y-3">
              <Repeat className="w-9 h-9 mx-auto text-primary" />
              <p className="text-muted-foreground">No subscriptions yet</p>
              <Button onClick={openNew}><Plus /> Add your first subscription</Button>
            </CardContent>
          </Card>
        ) : (
          subs.map((sub) => {
            const KindIcon = KIND_ICON[sub.kind];
            const flow = subscriptionFlow(sub);
            return (
              <div
                key={sub.id}
                
                onClick={() => openEdit(sub)}
                className={cn("bt-row p-3 cursor-pointer space-y-2", !sub.active && "opacity-60")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <KindIcon className="w-5 h-5 mt-0.5 text-primary shrink-0" aria-label={SUBSCRIPTION_KIND_LABEL[sub.kind]} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{sub.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {cycleLabel(sub)} · from {format(parseISO(sub.startDate), "d MMM yyyy")}
                        {sub.category && ` · ${sub.category}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {sub.personId !== undefined && `${nameOf(sub.personId)}`}
                        {sub.kind === "other" && ` · paid by ${sub.paidByMe ? "me" : "them"}`}
                        {sub.kind === "loan" && ` · ${sub.paidByMe ? "I pay them" : "they pay me"}`}
                        {sub.accountId !== undefined && `${sub.personId !== undefined ? " · " : ""}${accounts.find((a) => a.id === sub.accountId)?.name ?? ""}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn("font-semibold tabular-nums", flow === 1 && "text-positive")}>
                      {flow === 1 ? "+" : ""}{formatMoney(sub.amount, sub.currency)}
                    </div>
                    {sub.currency !== "NZD" && <div className="text-xs text-muted-foreground">≈ {formatMoney(toNZD(sub.amount, sub.currency, rates))}</div>}
                  </div>
                </div>
                <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={sub.active} onCheckedChange={(v) => toggleActive(sub, v)} aria-label={`${sub.name} active`} />
                    {sub.active ? "Active" : "Paused"}
                  </label>
                  <div>
                    <IconButton icon={Pencil} label="Edit subscription" onClick={() => openEdit(sub)} />
                    <IconButton icon={Trash2} tone="danger" label="Delete subscription" onClick={() => setDeleting(sub)} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Card className={cardCls}>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" />Project to date</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Project until">
              <IconInput icon={Calendar} type="date" min={todayStr()} value={targetDate} onChange={(e) => { setTargetDate(e.target.value); setUnticked(new Set()); }} className="w-48" />
            </Field>
            <div className="flex gap-1">
              {[["1 month", 1], ["3 months", 3], ["6 months", 6], ["1 year", 12]].map(([label, m]) => (
                <Button key={label as string} type="button" variant="outline" size="sm" onClick={() => { setHorizon(m as number); setUnticked(new Set()); }}>{label}</Button>
              ))}
            </div>
          </div>
          {projected.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No payments fall between today and then.</p>
          ) : (
            <div className="space-y-1.5">
              {projected.map((row) => (
                <label key={row.key} className="bt-row flex items-center gap-3 p-2.5 cursor-pointer">
                  <Checkbox checked={!unticked.has(row.key)} onCheckedChange={(c) => toggleRow(row.key, c === true)} />
                  <span className="text-sm text-muted-foreground w-24 shrink-0">{format(row.date, "d MMM yyyy")}</span>
                  <span className="flex-1 truncate">{row.sub.name}</span>
                  <span className={cn("text-sm tabular-nums", subscriptionFlow(row.sub) === 1 && "text-positive")}>
                    {subscriptionFlow(row.sub) === 1 ? "+" : ""}{formatMoney(row.sub.amount, row.sub.currency)}
                  </span>
                </label>
              ))}
              <div className="bt-tile p-4 mt-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedRows.length} of {projected.length} payments · {projectedTotal >= 0 ? "projected spend" : "projected net income"} (NZD)
                </span>
                <span className={cn("text-2xl font-bold tabular-nums", projectedTotal >= 0 ? "text-negative" : "text-positive")}>{formatMoney(Math.abs(projectedTotal))}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EntryDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        icon={Repeat}
        title={dialog.editingId !== null ? "Edit subscription" : "Add subscription"}
        submitLabel={dialog.editingId !== null ? "Save changes" : "Add"}
        submitIcon={dialog.editingId !== null ? Save : Plus}
        onSubmit={save}
        wide
      >
        <Segmented
          label="Subscription type"
          value={form.kind}
          onChange={(k) => set("kind", k)}
          options={[
            { value: "own", label: "Mine", icon: User, hint: SUBSCRIPTION_KIND_LABEL.own },
            { value: "other", label: "Someone else's", icon: Users, hint: SUBSCRIPTION_KIND_LABEL.other },
            { value: "loan", label: "Loan", icon: HandCoins, hint: SUBSCRIPTION_KIND_LABEL.loan },
          ]}
        />
        {form.kind !== "own" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={form.kind === "loan" ? "Loan with" : "Whose subscription"}>
              <PersonSelect people={people} value={form.personId} onChange={(id) => set("personId", id)} onAdd={addPerson} />
            </Field>
            <Field label={form.kind === "loan" ? "Direction" : "Paid by"}>
              <Segmented
                label="Direction" compact value={form.paidByMe ? "me" : "them"} onChange={(v) => set("paidByMe", v === "me")}
                options={[
                  { value: "me", label: form.kind === "loan" ? "I pay" : "Me" },
                  { value: "them", label: form.kind === "loan" ? "They pay" : "Them" },
                ]}
              />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name">
            <IconInput icon={FileText} data-autofocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Streaming service" />
          </Field>
          <Field label="Amount">
            <div className="flex gap-2">
              <IconInput symbol="$" type="number" inputMode="decimal" step="0.01" min="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" />
              <Select value={form.currency} onValueChange={(v) => set("currency", v as Currency)}>
                <SelectTrigger className={`${triggerCls} w-24`} aria-label="Currency"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </Field>
          <Field label="Billing period"><CycleSelect value={form.cycle} onChange={(c) => set("cycle", c)} /></Field>
          <Field label="First payment"><IconInput icon={Calendar} type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
          <Field label="Category">
            <CategorySelect categories={categories} value={form.category} onChange={(v) => set("category", v)} onAdd={addCategory} />
          </Field>
          {(form.kind !== "other" || form.paidByMe) && (
            <Field label="Account" hint="Applied to this account's history through the timeline.">
              <Select
                value={form.accountId !== null && accounts.some((a) => a.id === form.accountId) ? String(form.accountId) : NO_ACCOUNT}
                onValueChange={(v) => set("accountId", v === NO_ACCOUNT ? null : Number(v))}
              >
                <SelectTrigger className={triggerCls}><Landmark className="w-4 h-4 mr-2 text-muted-foreground shrink-0" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCOUNT}>No account</SelectItem>
                  {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <Field label="Rounding" hint="How cents are rounded when the payment is converted to NZD and applied to an account.">
          <RoundingSelect value={form.rounding} onChange={(r) => set("rounding", r)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground/80">
          <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
          {form.active ? "Active" : "Paused"}
        </label>
      </EntryDialog>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.name}"?`}
        description="It will also disappear from any account history it was applied to."
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
