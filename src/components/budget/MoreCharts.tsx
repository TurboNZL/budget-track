import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Account, Debt, Subscription, Transaction } from "@/lib/database";
import { formatMoney, type ExchangeRates } from "@/lib/finance";
import { accountBalanceSeries, categoryByMonth, debtProgress, monthlyFlow, subscriptionCosts, weekdaySpending } from "@/lib/graphs";
import { CHART_COLORS, ChartDefs, useChartStyle } from "./charts";
import { cardCls } from "./styles";

const axisMoney = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-center py-12">{children}</p>;
}

type Props = {
  accounts: Account[];
  transactions: Transaction[];
  subs: Subscription[];
  debts: Debt[];
  rates: ExchangeRates;
  today: Date;
};

/** The extra charts: cash flow, category trends, weekday habits, per-account balances, subscriptions and debt progress. */
export default function MoreCharts({ accounts, transactions, subs, debts, rates, today }: Props) {
  const c = useChartStyle();
  const tooltipProps = { ...c.tooltip, formatter: (value: number) => formatMoney(value) };
  const curve = c.ui === "winxp" || c.ui === "win10" || c.ui === "win98" ? "linear" : "monotone";

  const flow = useMemo(() => monthlyFlow(transactions, today), [transactions, today]);
  const hasFlow = flow.some((p) => p.income > 0 || p.spending > 0);
  const byCategory = useMemo(() => categoryByMonth(transactions, today), [transactions, today]);
  const weekdays = useMemo(() => weekdaySpending(transactions), [transactions]);
  const hasWeekdays = weekdays.some((d) => d.value > 0);
  const perAccount = useMemo(() => accountBalanceSeries(accounts, transactions, today), [accounts, transactions, today]);
  const subCosts = useMemo(() => subscriptionCosts(subs, rates), [subs, rates]);
  const progress = useMemo(() => debtProgress(debts, rates), [debts, rates]);

  return (
    <>
      <Card className={`${cardCls} bt-span`}>
        <CardHeader>
          <CardTitle>Income vs spending</CardTitle>
          <CardDescription>Per month for the last 12 months. Transfers between your own accounts are left out.</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasFlow ? <Empty>No dated income or spending yet</Empty> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={flow} margin={{ right: 16 }}>
                <ChartDefs /><CartesianGrid {...c.grid} vertical={false} />
                <XAxis dataKey="label" {...c.axis} minTickGap={16} />
                <YAxis {...c.axis} tickFormatter={axisMoney} />
                <Tooltip {...tooltipProps} cursor={{ fill: "hsl(var(--raised))", opacity: 0.4 }} />
                <Legend />
                <Bar dataKey="income" name="Income" {...c.bar(1)} maxBarSize={28} />
                <Bar dataKey="spending" name="Spending" {...c.bar(3)} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cardCls}>
        <CardHeader>
          <CardTitle>Net saved per month</CardTitle>
          <CardDescription>Income minus spending. Below zero means you spent more than you earned.</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasFlow ? <Empty>No dated income or spending yet</Empty> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={flow} margin={{ right: 16 }}>
                <ChartDefs /><CartesianGrid {...c.grid} />
                <XAxis dataKey="label" {...c.axis} minTickGap={16} />
                <YAxis {...c.axis} tickFormatter={axisMoney} />
                <Tooltip {...tooltipProps} />
                <Line type={curve} dataKey="net" name="Net" {...c.line(2)} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cardCls}>
        <CardHeader>
          <CardTitle>Spending by category over time</CardTitle>
          <CardDescription>Your biggest categories for the last 6 months, stacked.</CardDescription>
        </CardHeader>
        <CardContent>
          {byCategory.keys.length === 0 ? <Empty>No spending in the last 6 months</Empty> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={byCategory.rows} margin={{ right: 16 }}>
                <ChartDefs /><CartesianGrid {...c.grid} vertical={false} />
                <XAxis dataKey="label" {...c.axis} />
                <YAxis {...c.axis} tickFormatter={axisMoney} />
                <Tooltip {...tooltipProps} />
                <Legend />
                {byCategory.keys.map((k, i) => (
                  <Area key={k} type={curve} dataKey={k} stackId="spend" stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.55}
                    strokeWidth={c.cs.lineWidth} isAnimationActive={c.cs.animateMs > 0} animationDuration={c.cs.animateMs} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cardCls}>
        <CardHeader>
          <CardTitle>Spending by day of the week</CardTitle>
          <CardDescription>Total spent on each weekday across all dated spending.</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasWeekdays ? <Empty>No dated spending yet</Empty> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekdays} margin={{ right: 16 }}>
                <ChartDefs /><CartesianGrid {...c.grid} vertical={false} />
                <XAxis dataKey="name" {...c.axis} />
                <YAxis {...c.axis} tickFormatter={axisMoney} />
                <Tooltip {...tooltipProps} cursor={{ fill: "hsl(var(--raised))", opacity: 0.4 }} />
                <Bar dataKey="value" name="Spent" {...c.bar(4)} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cardCls}>
        <CardHeader>
          <CardTitle>Balance per account</CardTitle>
          <CardDescription>Month-end balance of each account over the last 12 months.</CardDescription>
        </CardHeader>
        <CardContent>
          {perAccount.keys.length === 0 ? <Empty>No accounts yet</Empty> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={perAccount.rows} margin={{ right: 16 }}>
                <ChartDefs /><CartesianGrid {...c.grid} />
                <XAxis dataKey="label" {...c.axis} minTickGap={16} />
                <YAxis {...c.axis} tickFormatter={axisMoney} />
                <Tooltip {...tooltipProps} />
                <Legend />
                {perAccount.keys.map((k, i) => (
                  <Line key={k} type={curve} dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={c.cs.lineWidth} dot={false}
                    isAnimationActive={c.cs.animateMs > 0} animationDuration={c.cs.animateMs} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cardCls}>
        <CardHeader>
          <CardTitle>Cost of each subscription</CardTitle>
          <CardDescription>Approximate NZD per month, top 10 active subscriptions you pay for.</CardDescription>
        </CardHeader>
        <CardContent>
          {subCosts.length === 0 ? <Empty>No active subscriptions</Empty> : (
            <ResponsiveContainer width="100%" height={Math.max(200, subCosts.length * 40 + 60)}>
              <BarChart data={subCosts} layout="vertical" margin={{ left: 8, right: 16 }}>
                <ChartDefs /><CartesianGrid {...c.grid} horizontal={false} />
                <XAxis type="number" {...c.axis} tickFormatter={axisMoney} />
                <YAxis type="category" dataKey="name" {...c.axis} width={100} />
                <Tooltip {...tooltipProps} cursor={{ fill: "hsl(var(--raised))", opacity: 0.4 }} />
                <Bar dataKey="value" name="Per month" {...c.bar(5)} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={cardCls}>
        <CardHeader>
          <CardTitle>Debt progress</CardTitle>
          <CardDescription>Paid off versus still outstanding for each open debt. Stale debts are left out.</CardDescription>
        </CardHeader>
        <CardContent>
          {progress.length === 0 ? <Empty>No open debts</Empty> : (
            <ResponsiveContainer width="100%" height={Math.max(200, progress.length * 48 + 60)}>
              <BarChart data={progress} layout="vertical" margin={{ left: 8, right: 16 }}>
                <ChartDefs /><CartesianGrid {...c.grid} horizontal={false} />
                <XAxis type="number" {...c.axis} tickFormatter={axisMoney} />
                <YAxis type="category" dataKey="name" {...c.axis} width={100} />
                <Tooltip {...tooltipProps} cursor={{ fill: "hsl(var(--raised))", opacity: 0.4 }} />
                <Legend />
                <Bar dataKey="paid" name="Paid off" stackId="d" {...c.bar(1)} radius={0} maxBarSize={20} />
                <Bar dataKey="remaining" name="Remaining" stackId="d" {...c.bar(3)} radius={0} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </>
  );
}
