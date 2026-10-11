import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, parseISO, startOfDay, startOfMonth } from "date-fns";
import type { Account, Debt, Person, Subscription, Transaction } from "./database";
import { getOccurrences, monthlyAmountNZD, toNZD, type ExchangeRates } from "./finance";
import { subscriptionFlow } from "./subscriptionFlow";

const DAYS_PER_MONTH = 30.4375;
const LOOKBACK_DAYS = 90;

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- Debt by person ---------- */

export type PersonDebtRow = { name: string; owe: number; owed: number };

/** Outstanding balances (NZD) per person, largest first. Settled debts are skipped. */
export const debtByPerson = (debts: Debt[], people: Person[], rates: ExchangeRates): PersonDebtRow[] => {
  const rows = new Map<number, PersonDebtRow>();
  for (const d of debts) {
    if (!(d.currentBalance > 0)) continue;
    const row = rows.get(d.personId) ?? {
      name: people.find((p) => p.id === d.personId)?.name ?? "Unknown",
      owe: 0,
      owed: 0,
    };
    row[d.direction] += toNZD(d.currentBalance, d.currency, rates);
    rows.set(d.personId, row);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, owe: round2(r.owe), owed: round2(r.owed) }))
    .sort((a, b) => b.owe + b.owed - (a.owe + a.owed));
};

/* ---------- Debt payoff projection ---------- */

export type PayoffSummary = {
  remaining: number;
  /** Average NZD repaid per month over the lookback window. */
  monthlyRate: number;
  monthsToClear: number | null;
};

export type PayoffResult = {
  points: { label: string; owe: number; owed: number }[];
  owe: PayoffSummary;
  owed: PayoffSummary;
  lookbackDays: number;
};

const MAX_PAYOFF_MONTHS = 60;

/**
 * Projects outstanding debt forward assuming repayments continue at the pace of the last 90 days.
 */
export const projectDebtPayoff = (debts: Debt[], rates: ExchangeRates, today: Date): PayoffResult => {
  const from = addDays(startOfDay(today), -LOOKBACK_DAYS);
  const summarise = (direction: Debt["direction"]): PayoffSummary => {
    const own = debts.filter((d) => d.direction === direction);
    const remaining = own.reduce((s, d) => s + toNZD(d.currentBalance, d.currency, rates), 0);
    const repaid = own.reduce(
      (s, d) =>
        s +
        d.repayments
          .filter((r) => {
            const date = parseISO(r.date);
            return date > from && date <= addDays(startOfDay(today), 1);
          })
          .reduce((rs, r) => rs + toNZD(r.amount, d.currency, rates), 0),
      0
    );
    const monthlyRate = repaid / (LOOKBACK_DAYS / DAYS_PER_MONTH);
    return {
      remaining,
      monthlyRate,
      monthsToClear: remaining <= 0 ? 0 : monthlyRate > 0 ? Math.ceil(remaining / monthlyRate) : null,
    };
  };

  const owe = summarise("owe");
  const owed = summarise("owed");
  const horizon = Math.min(
    MAX_PAYOFF_MONTHS,
    Math.max(12, owe.monthsToClear ?? 0, owed.monthsToClear ?? 0)
  );
  const start = startOfMonth(today);
  const points = Array.from({ length: horizon + 1 }, (_, k) => ({
    label: k === 0 ? "Now" : format(addMonths(start, k), "MMM yy"),
    owe: round2(Math.max(0, owe.remaining - owe.monthlyRate * k)),
    owed: round2(Math.max(0, owed.remaining - owed.monthlyRate * k)),
  }));
  return { points, owe, owed, lookbackDays: LOOKBACK_DAYS };
};

/* ---------- Balance history & projection ---------- */

export const totalBalance = (accounts: Account[], transactions: Transaction[]): number =>
  accounts.reduce((s, a) => s + a.unaccounted, 0) +
  transactions
    .filter((t) => accounts.some((a) => a.id === t.accountId))
    .reduce((s, t) => s + t.amount, 0);

/** Average monthly net change from transactions over the recent window (shorter if history is short). */
export const averageMonthlyNet = (
  transactions: Transaction[],
  today: Date
): { perMonth: number; windowDays: number } => {
  const dated = transactions.filter((t) => t.date);
  if (dated.length === 0) return { perMonth: 0, windowDays: LOOKBACK_DAYS };
  const earliest = dated.reduce((min, t) => (t.date! < min ? t.date! : min), dated[0].date!);
  const sinceFirst = differenceInCalendarDays(today, parseISO(earliest)) + 1;
  const windowDays = Math.min(LOOKBACK_DAYS, Math.max(30, sinceFirst));
  const from = addDays(startOfDay(today), -windowDays);
  const net = dated
    .filter((t) => {
      const d = parseISO(t.date!);
      return d > from && d <= addDays(startOfDay(today), 1);
    })
    .reduce((s, t) => s + t.amount, 0);
  return { perMonth: net / (windowDays / DAYS_PER_MONTH), windowDays };
};

export type BalancePoint = { label: string; actual?: number; projected?: number };

/** Month-end total balance for up to `months` months back, ending today. */
export const balanceHistory = (
  accounts: Account[],
  transactions: Transaction[],
  today: Date,
  months = 12
): BalancePoint[] => {
  const dated = transactions.filter((t) => t.date && accounts.some((a) => a.id === t.accountId));
  if (dated.length === 0) return [];
  const unaccounted = accounts.reduce((s, a) => s + a.unaccounted, 0);
  const earliest = dated.reduce((min, t) => (t.date! < min ? t.date! : min), dated[0].date!);
  const firstMonth = startOfMonth(parseISO(earliest));
  const windowStart = startOfMonth(addMonths(today, -months + 1));
  const start = firstMonth > windowStart ? firstMonth : windowStart;
  const points: BalancePoint[] = [];
  for (let m = start; m <= today; m = addMonths(m, 1)) {
    const isCurrent = m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
    const cutoff = format(isCurrent ? today : endOfMonth(m), "yyyy-MM-dd");
    const sum = dated.filter((t) => t.date! <= cutoff).reduce((s, t) => s + t.amount, 0);
    points.push({ label: isCurrent ? "Today" : format(m, "MMM yy"), actual: round2(sum + unaccounted) });
  }
  return points;
};

/**
 * Projects the total balance to each of the next `months` month-ends from today's balance, the recent
 * average transaction trend, and (optionally) the exact upcoming subscription / loan payments.
 */
export const projectBalance = (
  current: number,
  trendPerMonth: number,
  subs: Subscription[],
  rates: ExchangeRates,
  today: Date,
  months = 12,
  includeSubs = true
): BalancePoint[] => {
  const day = startOfDay(today);
  const points: BalancePoint[] = [{ label: "Today", projected: round2(current) }];
  const active = includeSubs ? subs.filter((s) => s.active && subscriptionFlow(s) !== 0) : [];
  for (let k = 1; k <= months; k++) {
    const end = endOfMonth(addMonths(day, k));
    const trend = (trendPerMonth * differenceInCalendarDays(end, day)) / DAYS_PER_MONTH;
    const subFlow = active.reduce(
      (s, sub) =>
        s +
        subscriptionFlow(sub) *
          getOccurrences(sub.startDate, sub, day, end).length *
          toNZD(sub.amount, sub.currency, rates),
      0
    );
    points.push({ label: format(end, "MMM yy"), projected: round2(current + trend + subFlow) });
  }
  return points;
};

/* ---------- Subscription cost ---------- */

/** Monthly NZD spend on subscriptions I pay for (loans excluded), by category, largest first. */
export const subscriptionSpendByCategory = (subs: Subscription[], rates: ExchangeRates) => {
  const map = new Map<string, number>();
  for (const s of subs) {
    if (!s.active || s.kind === "loan" || subscriptionFlow(s) !== -1) continue;
    map.set(s.category || "Uncategorised", (map.get(s.category || "Uncategorised") ?? 0) + monthlyAmountNZD(s.amount, s.currency, s, rates));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value);
};

/* ---------- Cash flow ---------- */

/** Transfers between your own accounts are neither income nor spending. */
const external = (transactions: Transaction[]) => transactions.filter((t) => t.transferId === undefined && t.date);

const monthStarts = (today: Date, months: number) =>
  Array.from({ length: months }, (_, k) => startOfMonth(addMonths(today, k - months + 1)));

export type FlowPoint = { label: string; income: number; spending: number; net: number };

/** Income, spending and the difference for each of the last `months` calendar months. */
export const monthlyFlow = (transactions: Transaction[], today: Date, months = 12): FlowPoint[] => {
  const tx = external(transactions);
  return monthStarts(today, months).map((m) => {
    const key = format(m, "yyyy-MM");
    const inMonth = tx.filter((t) => t.date!.startsWith(key));
    const income = inMonth.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const spending = inMonth.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
    return { label: format(m, "MMM yy"), income: round2(income), spending: round2(spending), net: round2(income - spending) };
  });
};

export type StackedSeries = { rows: Record<string, number | string>[]; keys: string[] };

/** Spending per month for the biggest categories (everything else grouped as "Other"). */
export const categoryByMonth = (transactions: Transaction[], today: Date, months = 6, top = 5): StackedSeries => {
  const spend = external(transactions).filter((t) => t.amount < 0);
  const starts = monthStarts(today, months);
  const range = new Set(starts.map((m) => format(m, "yyyy-MM")));
  const totals = new Map<string, number>();
  for (const t of spend) {
    if (!range.has(t.date!.slice(0, 7))) continue;
    const c = t.category || "Uncategorised";
    totals.set(c, (totals.get(c) ?? 0) - t.amount);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const keys = ranked.slice(0, top);
  const hasOther = ranked.length > top;
  const rows = starts.map((m) => {
    const key = format(m, "yyyy-MM");
    const row: Record<string, number | string> = { label: format(m, "MMM yy") };
    for (const k of keys) row[k] = 0;
    if (hasOther) row.Other = 0;
    for (const t of spend) {
      if (!t.date!.startsWith(key)) continue;
      const c = t.category || "Uncategorised";
      const col = keys.includes(c) ? c : "Other";
      row[col] = round2((row[col] as number) - t.amount);
    }
    return row;
  });
  return { rows, keys: hasOther ? [...keys, "Other"] : keys };
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Total spending by day of the week (Monday first). */
export const weekdaySpending = (transactions: Transaction[]): { name: string; value: number }[] => {
  const totals = Array(7).fill(0) as number[];
  for (const t of external(transactions)) {
    if (t.amount >= 0) continue;
    const day = (parseISO(t.date!).getDay() + 6) % 7;
    totals[day] -= t.amount;
  }
  return WEEKDAYS.map((name, i) => ({ name, value: round2(totals[i]) }));
};

/** Month-end balance of every account over the last `months` months. */
export const accountBalanceSeries = (accounts: Account[], transactions: Transaction[], today: Date, months = 12): StackedSeries => {
  const keys = accounts.map((a) => a.name);
  const rows = monthStarts(today, months).map((m) => {
    const isCurrent = m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
    const cutoff = format(isCurrent ? today : endOfMonth(m), "yyyy-MM-dd");
    const row: Record<string, number | string> = { label: isCurrent ? "Today" : format(m, "MMM yy") };
    for (const a of accounts) {
      const sum = transactions.filter((t) => t.accountId === a.id && (t.date ?? "") <= cutoff).reduce((s, t) => s + t.amount, 0);
      row[a.name] = round2(sum + a.unaccounted);
    }
    return row;
  });
  return { rows, keys };
};

/* ---------- Subscriptions & debts ---------- */

/** Approximate NZD per month for each subscription I pay for, largest first. */
export const subscriptionCosts = (subs: Subscription[], rates: ExchangeRates, top = 10) =>
  subs
    .filter((s) => s.active && s.kind !== "loan" && subscriptionFlow(s) === -1)
    .map((s) => ({ name: s.name, value: round2(monthlyAmountNZD(s.amount, s.currency, s, rates)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);

/** How much of each unsettled debt is paid and how much remains (NZD), skipping stale debts. */
export const debtProgress = (debts: Debt[], rates: ExchangeRates) =>
  debts
    .filter((d) => !d.stale && d.amount > 0 && d.currentBalance > 0)
    .map((d) => {
      const remaining = toNZD(d.currentBalance, d.currency, rates);
      const total = toNZD(d.amount, d.currency, rates);
      return { name: d.name, paid: round2(Math.max(0, total - remaining)), remaining: round2(remaining), direction: d.direction };
    })
    .sort((a, b) => b.remaining - a.remaining);
