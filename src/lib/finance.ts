import { addDays, addMonths, addYears, isValid, parseISO, startOfDay } from "date-fns";

export type Currency = "NZD" | "USD" | "EUR";
export const CURRENCIES: Currency[] = ["NZD", "USD", "EUR"];
export const DEFAULT_CURRENCY: Currency = "NZD";

/** Units of foreign currency per 1 NZD (e.g. USD: 0.60 means 1 NZD = 0.60 USD). */
export type ExchangeRates = { USD: number; EUR: number };
export const DEFAULT_RATES: ExchangeRates = { USD: 0.6, EUR: 0.55 };

export const toNZD = (amount: number, currency: Currency, rates: ExchangeRates): number => {
  if (currency === "NZD") return amount;
  const rate = rates[currency];
  return rate > 0 ? amount / rate : amount;
};

export const formatMoney = (amount: number, currency: Currency = DEFAULT_CURRENCY): string => {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount).toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "NZD" ? "$" : currency === "USD" ? "US$" : "€";
  return `${sign}${symbol}${abs}`;
};

/* ---------- Rounding ---------- */

export type Rounding = "nearest" | "up" | "down";
export const ROUNDING_OPTIONS: { id: Rounding; label: string }[] = [
  { id: "nearest", label: "Nearest cent" },
  { id: "down", label: "Round down" },
  { id: "up", label: "Round up" },
];

/**
 * Rounds a money amount to cents. "up" and "down" act on the size of the amount (away from / toward
 * zero), so a payment of -1.234 rounds up to -1.24, the same way a deposit of 1.234 does.
 */
export const roundMoney = (amount: number, mode: Rounding = "nearest"): number => {
  const sign = amount < 0 ? -1 : 1;
  const cents = Math.abs(amount) * 100;
  // The epsilon stops float noise (e.g. 1.005 * 100 = 100.49999) from flipping the result
  const eps = 1e-7;
  const rounded = mode === "up" ? Math.ceil(cents - eps) : mode === "down" ? Math.floor(cents + eps) : Math.round(cents + eps);
  const value = (sign * rounded) / 100;
  return value === 0 ? 0 : value;
};

/* ---------- Periods (billing / crediting) ---------- */

export type PeriodUnit = "days" | "weeks" | "months" | "years";
export type Period = { every: number; unit: PeriodUnit };

export type BillingCycle =
  | "daily"
  | "weekly"
  | "fortnightly"
  | "four-weekly"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "four-monthly"
  | "half-yearly"
  | "annual"
  | "two-yearly"
  | "custom";

export const BILLING_PRESETS: { id: Exclude<BillingCycle, "custom">; label: string; period: Period }[] = [
  { id: "daily", label: "Daily", period: { every: 1, unit: "days" } },
  { id: "weekly", label: "Weekly", period: { every: 1, unit: "weeks" } },
  { id: "fortnightly", label: "Fortnightly", period: { every: 2, unit: "weeks" } },
  { id: "four-weekly", label: "Every 4 weeks", period: { every: 4, unit: "weeks" } },
  { id: "monthly", label: "Monthly", period: { every: 1, unit: "months" } },
  { id: "bimonthly", label: "Every 2 months", period: { every: 2, unit: "months" } },
  { id: "quarterly", label: "Quarterly", period: { every: 3, unit: "months" } },
  { id: "four-monthly", label: "Every 4 months", period: { every: 4, unit: "months" } },
  { id: "half-yearly", label: "Half-yearly", period: { every: 6, unit: "months" } },
  { id: "annual", label: "Yearly", period: { every: 1, unit: "years" } },
  { id: "two-yearly", label: "Every 2 years", period: { every: 2, unit: "years" } },
];
export const BILLING_CYCLES: BillingCycle[] = [...BILLING_PRESETS.map((p) => p.id), "custom"];

export const PERIOD_UNITS: PeriodUnit[] = ["days", "weeks", "months", "years"];

/** A cycle plus the custom interval used when the cycle is "custom". */
export type CycleSpec = { billingCycle: BillingCycle; billingEvery?: number; billingUnit?: PeriodUnit };

export const cyclePeriod = (spec: CycleSpec): Period => {
  if (spec.billingCycle === "custom") {
    const every = Math.max(1, Math.round(spec.billingEvery ?? 1));
    return { every, unit: spec.billingUnit && PERIOD_UNITS.includes(spec.billingUnit) ? spec.billingUnit : "months" };
  }
  return (BILLING_PRESETS.find((p) => p.id === spec.billingCycle) ?? BILLING_PRESETS[4]).period;
};

export const periodLabel = (period: Period): string => {
  const preset = BILLING_PRESETS.find((p) => p.period.every === period.every && p.period.unit === period.unit);
  if (preset) return preset.label;
  const unit = period.every === 1 ? period.unit.replace(/s$/, "") : period.unit;
  return `Every ${period.every === 1 ? "" : period.every + " "}${unit}`.replace("  ", " ");
};

export const cycleLabel = (spec: CycleSpec): string => periodLabel(cyclePeriod(spec));

const nthPayment = (start: Date, period: Period, n: number): Date => {
  const k = period.every * n;
  switch (period.unit) {
    case "days":
      return addDays(start, k);
    case "weeks":
      return addDays(start, 7 * k);
    case "months":
      // Computed from the start date each time so e.g. 31 Jan -> 28 Feb -> 31 Mar (no drift)
      return addMonths(start, k);
    case "years":
      return addYears(start, k);
  }
};

/** All payment dates in [from, to] (inclusive, by calendar day) for a recurring payment. */
export const getOccurrences = (startDate: string, spec: CycleSpec | Period, from: Date, to: Date): Date[] => {
  const period = "unit" in spec ? spec : cyclePeriod(spec);
  const start = startOfDay(parseISO(startDate));
  if (!isValid(start)) return [];
  const fromDay = startOfDay(from);
  const toDay = startOfDay(to);
  const result: Date[] = [];
  for (let n = 0; n < 20000; n++) {
    const d = nthPayment(start, period, n);
    if (d > toDay) break;
    if (d >= fromDay) result.push(d);
  }
  return result;
};

/* ---------- Interest ---------- */

export type Compounding =
  | "simple"
  | "annually"
  | "semiannually"
  | "quarterly"
  | "monthly"
  | "fortnightly"
  | "weekly"
  | "daily";
export const COMPOUNDING_OPTIONS: { id: Compounding; label: string }[] = [
  { id: "simple", label: "Simple (no compounding)" },
  { id: "daily", label: "Compounded daily" },
  { id: "weekly", label: "Compounded weekly" },
  { id: "fortnightly", label: "Compounded fortnightly" },
  { id: "monthly", label: "Compounded monthly" },
  { id: "quarterly", label: "Compounded quarterly" },
  { id: "semiannually", label: "Compounded half-yearly" },
  { id: "annually", label: "Compounded yearly" },
];

const COMPOUNDS_PER_YEAR: Record<Exclude<Compounding, "simple">, number> = {
  annually: 1,
  semiannually: 2,
  quarterly: 4,
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
  daily: 365,
};

export const periodToYears = (value: number, unit: PeriodUnit): number => {
  switch (unit) {
    case "days":
      return value / 365;
    case "weeks":
      return value / 52;
    case "months":
      return value / 12;
    case "years":
      return value;
  }
};

export const calcInterest = (
  principal: number,
  ratePct: number,
  years: number,
  compounding: Compounding
): number => {
  const r = ratePct / 100;
  if (compounding === "simple") return principal * r * years;
  const n = COMPOUNDS_PER_YEAR[compounding];
  return principal * (Math.pow(1 + r / n, n * years) - 1);
};

/** Annual rate (%) that turns `principal` into `balanceAfter` over `years`; null if undefined. */
export const impliedRatePct = (
  principal: number,
  balanceAfter: number,
  years: number,
  compounding: Compounding
): number | null => {
  if (!(principal > 0) || !(balanceAfter > 0) || !(years > 0)) return null;
  if (compounding === "simple") {
    return ((balanceAfter - principal) / (principal * years)) * 100;
  }
  const n = COMPOUNDS_PER_YEAR[compounding];
  return n * (Math.pow(balanceAfter / principal, 1 / (n * years)) - 1) * 100;
};

/** How many payments a period makes in a year (weeks count as 52 a year, days as 365). */
export const paymentsPerYear = (period: Period): number => {
  switch (period.unit) {
    case "days":
      return 365 / period.every;
    case "weeks":
      return 52 / period.every;
    case "months":
      return 12 / period.every;
    case "years":
      return 1 / period.every;
  }
};

/** Approximate NZD per month for a recurring amount. */
export const monthlyAmountNZD = (
  amount: number,
  currency: Currency,
  spec: CycleSpec,
  rates: ExchangeRates
): number => (toNZD(amount, currency, rates) * paymentsPerYear(cyclePeriod(spec))) / 12;
