import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import type {
  Account,
  AutoRepay,
  Debt,
  EventOverride,
  InterestRule,
  Subscription,
  TaxRule,
  Timeline,
  Transaction,
} from "./database";
import { getOccurrences, roundMoney, toNZD, cyclePeriod, type ExchangeRates, type Rounding } from "./finance";
import { subscriptionFlow } from "./subscriptionFlow";

export const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export type LedgerKind = "opening" | "tx" | "sub" | "interest" | "tax" | "loan";

export type LedgerRow = {
  key: string;
  kind: LedgerKind;
  /** yyyy-MM-dd; empty for the undated opening row */
  date: string;
  label: string;
  detail?: string;
  category?: string;
  /** Effect on the balance (0 for memo rows). */
  amount: number;
  /** Balance after this row. */
  balance: number;
  generated: boolean;
  /** Shown for information only, no effect on the balance. */
  memo?: boolean;
  /** Unrounded value of a generated amount (with its sign). */
  rawAmount?: number;
  rounding?: Rounding;
  /** True when the rounding mode can change the amount. */
  roundable?: boolean;
  scheduledDate?: string;
};

export type KeyframeKind = "sub" | "interest" | "tax" | "loan";

export type Keyframe = {
  key: string;
  kind: KeyframeKind;
  lane: string;
  laneLabel: string;
  label: string;
  scheduled: string;
  /** Effective day (after any override). */
  date: string;
  skipped: boolean;
  amount?: number;
};

export type Range = { start: string; end: string };

export type LedgerContext = {
  account: Account;
  /** All accounts; used to name the other side of a transfer. */
  accounts?: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  interestRules: InterestRule[];
  taxRules: TaxRule[];
  debts: Debt[];
  rates: ExchangeRates;
  timeline?: Timeline;
};

export type LedgerResult = {
  rows: LedgerRow[];
  keyframes: Keyframe[];
  opening: number;
  closing: number;
};

/** Default timeline range: the account's first dated transaction to today. */
export const defaultRange = (account: Account, transactions: Transaction[], today: Date): Range => {
  const dates = transactions.filter((t) => t.accountId === account.id && t.date).map((t) => t.date!);
  const first = dates.length > 0 ? dates.reduce((m, d) => (d < m ? d : m), dates[0]) : ymd(today);
  const end = ymd(today);
  return { start: first < end ? first : end, end };
};

export const effectiveRange = (tl: Timeline | undefined, def: Range): Range => {
  const start = tl?.start ?? def.start;
  const end = tl?.end ?? def.end;
  return start <= end ? { start, end } : { start: end, end: start };
};

/* ---------- Income deductions ---------- */

const PERIODS_PER_YEAR = { weekly: 52, fortnightly: 26, monthly: 12 } as const;

/** Student-loan style deduction: rate x (pay above the per-pay threshold). */
export const loanDeductionRaw = (income: number, rule: Pick<AutoRepay, "ratePct" | "thresholdAnnual" | "payFrequency" | "incomeIsGross">): number => {
  if (!(income > 0)) return 0;
  const r = rule.ratePct / 100;
  const threshold = rule.thresholdAnnual / PERIODS_PER_YEAR[rule.payFrequency];
  if (rule.incomeIsGross) return Math.max(0, income - threshold) * r;
  // Logged income is take-home: gross = (net - r*T) / (1 - r) once above the threshold
  if (income <= threshold) return 0;
  const gross = (income - r * threshold) / (1 - r);
  return gross - income;
};

/** Flat-rate deduction (income tax). */
export const taxDeductionRaw = (income: number, ratePct: number, incomeIsGross: boolean): number => {
  if (!(income > 0)) return 0;
  const r = ratePct / 100;
  return incomeIsGross ? income * r : (income / (1 - r)) * r;
};

export type AutoRepayEntry = { txId: number; date: string; income: number; deduction: number };

/** Everything skimmed off logged income so far for a loan with an auto-repay rule. */
export const autoRepayments = (debt: Debt, transactions: Transaction[], today: Date): { total: number; entries: AutoRepayEntry[] } => {
  const rule = debt.autoRepay;
  if (!rule) return { total: 0, entries: [] };
  const todayStr = ymd(today);
  const entries = transactions
    .filter(
      (t) =>
        t.type === "income" &&
        t.amount > 0 &&
        t.date &&
        t.date >= rule.startDate &&
        t.date <= todayStr &&
        (rule.accountId === undefined || t.accountId === rule.accountId)
    )
    .sort((a, b) => a.date!.localeCompare(b.date!) || a.id - b.id)
    .map((t) => ({
      txId: t.id,
      date: t.date!,
      income: t.amount,
      deduction: roundMoney(loanDeductionRaw(t.amount, rule), rule.rounding),
    }))
    .filter((e) => e.deduction > 0);
  const total = Math.round(entries.reduce((s, e) => s + e.deduction, 0) * 100) / 100;
  return { total, entries };
};

/** Debts with auto-repayments applied: lower balance, plus a synthetic repayment per deduction. */
export const withAutoRepayments = (debts: Debt[], transactions: Transaction[], today: Date): Debt[] =>
  debts.map((d) => {
    if (!d.autoRepay) return d;
    const { total, entries } = autoRepayments(d, transactions, today);
    return {
      ...d,
      currentBalance: Math.max(0, d.currentBalance - total),
      repayments: [
        ...d.repayments,
        ...entries.map((e) => ({ id: -e.txId, date: e.date, amount: e.deduction })),
      ],
    };
  });

/* ---------- Ledger simulation ---------- */

type Ev = {
  key: string;
  kind: LedgerKind;
  date: string;
  label: string;
  detail?: string;
  category?: string;
  amount: number;
  generated: boolean;
  memo?: boolean;
  rawAmount?: number;
  rounding?: Rounding;
  scheduledDate?: string;
  rank: number;
  sort: number;
};

const RANK = { tx: 0, sub: 1, loan: 2, taxIncome: 2, interest: 3, taxInterest: 4 } as const;
const MAX_DAYS = 40000;
const isFractional = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) > 1e-7;

const run = (ctx: LedgerContext, range: Range | null, opening: number): LedgerResult => {
  const { account, rates } = ctx;
  const overrides = ctx.timeline?.overrides ?? {};
  const dayOrder = ctx.timeline?.dayOrder ?? {};
  const ov = (key: string): EventOverride | undefined => overrides[key];
  const keyframes: Keyframe[] = [];
  const fixed = new Map<string, Ev[]>();
  const push = (map: Map<string, Ev[]>, ev: Ev) => {
    const list = map.get(ev.date) ?? [];
    list.push(ev);
    map.set(ev.date, list);
  };

  const acctTx = ctx.transactions
    .filter((t) => t.accountId === account.id)
    .map((t) => ({ ...t, date: t.date ?? "" }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  /** "Transfer to Savings" / "Transfer from Savings" for a leg of an account-to-account transfer. */
  const transferLabel = (t: Transaction): string | undefined => {
    if (t.transferId === undefined) return undefined;
    const other = ctx.transactions.find((x) => x.transferId === t.transferId && x.id !== t.id);
    const name = ctx.accounts?.find((a) => a.id === other?.accountId)?.name;
    return `Transfer ${t.amount < 0 ? "to" : "from"} ${name ?? "another account"}`;
  };
  for (const t of acctTx) {
    push(fixed, {
      key: `tx:${t.id}`,
      kind: "tx",
      date: t.date,
      label: t.description || transferLabel(t) || t.category || (t.amount >= 0 ? "Deposit" : "Withdrawal"),
      category: t.category,
      detail: t.type,
      amount: t.amount,
      generated: false,
      rank: RANK.tx,
      sort: t.id,
    });
  }

  const interestRules = range ? ctx.interestRules.filter((r) => r.active && r.accountId === account.id) : [];
  const interestDue = new Map<string, { rule: InterestRule; sched: string; key: string }[]>();

  if (range) {
    const from = parseISO(range.start);
    const to = parseISO(range.end);

    // Subscriptions & recurring loans
    for (const sub of ctx.subscriptions) {
      if (!sub.active || sub.accountId !== account.id) continue;
      const flow = subscriptionFlow(sub);
      if (flow === 0) continue;
      for (const occ of getOccurrences(sub.startDate, sub, from, to)) {
        const sched = ymd(occ);
        const key = `sub:${sub.id}:${sched}`;
        const o = ov(key);
        const raw = flow * toNZD(sub.amount, sub.currency, rates);
        const rounding = o?.rounding ?? sub.rounding;
        const amount = roundMoney(raw, rounding);
        keyframes.push({
          key, kind: "sub", lane: `sub:${sub.id}`, laneLabel: sub.name, label: sub.name,
          scheduled: sched, date: o?.date ?? sched, skipped: !!o?.skip, amount,
        });
        if (o?.skip) continue;
        push(fixed, {
          key, kind: "sub", date: o?.date ?? sched, label: sub.name, category: sub.category,
          detail: sub.kind === "loan" ? "Recurring loan payment" : "Subscription",
          amount, generated: true, rawAmount: raw, rounding, scheduledDate: sched, rank: RANK.sub, sort: sub.id,
        });
      }
    }

    // Deductions skimmed off income: income tax and loan auto-repayments
    const incomes = acctTx.filter((t) => t.type === "income" && t.amount > 0 && t.date >= range.start && t.date <= range.end);
    const deduct = (
      key: string, lane: string, laneLabel: string, kind: "tax" | "loan", t: (typeof incomes)[number],
      raw: number, defaultRounding: Rounding, gross: boolean, rank: number, detail: string
    ) => {
      if (!(raw > 0)) return;
      const o = ov(key);
      const rounding = o?.rounding ?? defaultRounding;
      const amount = roundMoney(raw, rounding);
      if (amount === 0) return;
      keyframes.push({
        key, kind, lane, laneLabel, label: `${laneLabel} (${t.description || "income"})`,
        scheduled: t.date, date: o?.date ?? t.date, skipped: !!o?.skip, amount: -amount,
      });
      if (o?.skip) return;
      push(fixed, {
        key, kind, date: o?.date ?? t.date, label: laneLabel,
        detail: gross ? detail : `${detail} · already taken out of the income you logged`,
        amount: gross ? -amount : 0, generated: true, memo: !gross, rawAmount: -raw, rounding, scheduledDate: t.date, rank, sort: t.id,
      });
    };
    for (const rule of ctx.taxRules) {
      if (!rule.active || rule.base !== "income" || (rule.accountId !== undefined && rule.accountId !== account.id)) continue;
      for (const t of incomes) {
        deduct(`tax:${rule.id}:tx${t.id}`, `tax:${rule.id}`, rule.name, "tax", t,
          taxDeductionRaw(t.amount, rule.ratePct, rule.incomeIsGross), rule.rounding, rule.incomeIsGross, RANK.taxIncome,
          `${rule.ratePct}% of income`);
      }
    }
    for (const debt of ctx.debts) {
      const rule = debt.autoRepay;
      if (!rule || (rule.accountId !== undefined && rule.accountId !== account.id)) continue;
      for (const t of incomes.filter((i) => i.date >= rule.startDate)) {
        deduct(`loan:${debt.id}:tx${t.id}`, `loan:${debt.id}`, debt.name, "loan", t,
          loanDeductionRaw(t.amount, rule), rule.rounding, rule.incomeIsGross, RANK.loan,
          `${rule.ratePct}% above the threshold`);
      }
    }

    // Interest: credit days (period ends), which close the accrual
    for (const rule of interestRules) {
      const horizon = addDays(to, 1);
      const occ = getOccurrences(rule.startDate, cyclePeriod(rule), parseISO(rule.startDate), horizon).slice(1);
      for (const d of occ) {
        const sched = ymd(d);
        if (sched < range.start || sched > range.end) continue;
        const key = `int:${rule.id}:${sched}`;
        const o = ov(key);
        const date = o?.date ?? sched;
        if (o?.skip) {
          keyframes.push({ key, kind: "interest", lane: `int:${rule.id}`, laneLabel: rule.name, label: rule.name, scheduled: sched, date, skipped: true });
          continue;
        }
        const list = interestDue.get(date) ?? [];
        list.push({ rule, sched, key });
        interestDue.set(date, list);
      }
    }
  }

  // Walk the days
  const eventDates = [...fixed.keys(), ...interestDue.keys()].filter(Boolean).sort();
  const dated = new Set<string>(eventDates);
  let dayList: string[];
  if (range && interestRules.length > 0) {
    const first = [range.start, ...eventDates].reduce((m, d) => (d < m ? d : m));
    const last = [range.end, ...eventDates].reduce((m, d) => (d > m ? d : m));
    const n = differenceInCalendarDays(parseISO(last), parseISO(first)) + 1;
    dayList = [];
    for (let i = 0; i < Math.min(n, MAX_DAYS); i++) dayList.push(ymd(addDays(startOfDay(parseISO(first)), i)));
  } else {
    dayList = [...dated];
  }

  const rows: LedgerRow[] = [];
  const undated = fixed.get("") ?? [];
  let balance = opening;
  rows.push({ key: "opening", kind: "opening", date: "", label: "Unaccounted for (undated)", amount: opening, balance: opening, generated: false });
  for (const ev of undated) {
    balance += ev.amount;
    rows.push(toRow(ev, balance));
  }

  const accrued = new Map<number, number>();
  for (const day of dayList) {
    const events = [...(fixed.get(day) ?? [])];
    const fixedSum = events.reduce((s, e) => s + e.amount, 0);
    const endBalance = balance + fixedSum;

    if (range && day >= range.start && day <= range.end) {
      for (const rule of interestRules) {
        if (day < rule.startDate) continue;
        accrued.set(rule.id, (accrued.get(rule.id) ?? 0) + (Math.max(0, endBalance) * rule.ratePct) / 100 / 365);
      }
      for (const due of interestDue.get(day) ?? []) {
        const raw = accrued.get(due.rule.id) ?? 0;
        accrued.set(due.rule.id, 0);
        const o = ov(due.key);
        const rounding = o?.rounding ?? due.rule.rounding;
        const amount = roundMoney(raw, rounding);
        keyframes.push({
          key: due.key, kind: "interest", lane: `int:${due.rule.id}`, laneLabel: due.rule.name, label: due.rule.name,
          scheduled: due.sched, date: day, skipped: false, amount,
        });
        if (!(raw > 0)) continue;
        events.push({
          key: due.key, kind: "interest", date: day, label: due.rule.name, detail: `Interest at ${due.rule.ratePct}% a year`,
          amount, generated: true, rawAmount: raw, rounding, scheduledDate: due.sched, rank: RANK.interest, sort: due.rule.id,
        });
        if (!due.rule.applyTax) continue;
        for (const tax of ctx.taxRules) {
          if (!tax.active || tax.base !== "interest" || (tax.accountId !== undefined && tax.accountId !== account.id)) continue;
          const taxKey = `tax:${tax.id}:${due.key}`;
          const to = ov(taxKey);
          if (to?.skip) continue;
          const taxRaw = (amount * tax.ratePct) / 100;
          const taxRounding = to?.rounding ?? tax.rounding;
          const taxAmount = roundMoney(taxRaw, taxRounding);
          if (taxAmount === 0) continue;
          events.push({
            key: taxKey, kind: "tax", date: day, label: tax.name, detail: `${tax.ratePct}% of ${due.rule.name}`,
            amount: -taxAmount, generated: true, rawAmount: -taxRaw, rounding: taxRounding,
            scheduledDate: due.sched, rank: RANK.taxInterest, sort: tax.id,
          });
        }
      }
    }

    const order = dayOrder[day];
    events.sort((a, b) => {
      if (order) {
        const ia = order.indexOf(a.key);
        const ib = order.indexOf(b.key);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
      }
      return a.rank - b.rank || a.sort - b.sort;
    });
    if (day === "") continue;
    for (const ev of events) {
      balance += ev.amount;
      rows.push(toRow(ev, balance));
    }
  }

  keyframes.sort((a, b) => a.date.localeCompare(b.date));
  return { rows, keyframes, opening, closing: balance };
};

const toRow = (ev: Ev, balance: number): LedgerRow => ({
  key: ev.key,
  kind: ev.kind,
  date: ev.date,
  label: ev.label,
  detail: ev.detail,
  category: ev.category,
  amount: ev.amount,
  balance,
  generated: ev.generated,
  memo: ev.memo,
  rawAmount: ev.rawAmount,
  rounding: ev.rounding,
  roundable: ev.generated && ev.rawAmount !== undefined && isFractional(ev.rawAmount),
  scheduledDate: ev.scheduledDate,
});

/**
 * Builds the account's ledger. With a range, subscriptions, interest, taxes and auto-repayments inside
 * it are overlaid on the real transactions. Locked accounts are shifted so they still end on the
 * locked balance.
 */
export const buildLedger = (ctx: LedgerContext, range: Range | null): LedgerResult => {
  let opening = ctx.account.unaccounted;
  let result = run(ctx, range, opening);
  if (ctx.account.locked) {
    for (let i = 0; i < 4; i++) {
      const delta = ctx.account.lockedBalance - result.closing;
      if (Math.abs(delta) < 0.005) break;
      opening += delta;
      result = run(ctx, range, opening);
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    ...result,
    opening: round(result.opening),
    closing: round(result.closing),
    rows: result.rows.map((r) => ({ ...r, balance: round(r.balance), amount: round(r.amount) })),
  };
};
