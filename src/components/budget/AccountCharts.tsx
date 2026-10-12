import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Transaction } from "@/lib/database";
import { formatMoney } from "@/lib/finance";
import { CHART_COLORS, ChartDefs, useChartStyle } from "./charts";
import { cardCls } from "./styles";

const axisMoney = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));

/** Net amount per category, as a bar chart and a breakdown of spending. */
export default function AccountCharts({ transactions, compact }: { transactions: Transaction[]; compact?: boolean }) {
  const c = useChartStyle();
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.transferId !== undefined) return; // moving money between your own accounts isn't spending
      const name = t.category || "Uncategorised";
      map[name] = (map[name] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [transactions]);
  const spending = useMemo(() => data.filter((d) => d.value < 0).map((d) => ({ name: d.name, value: Math.abs(d.value) })), [data]);
  const h = compact ? 200 : 260;

  return (
    <>
      <Card className={cardCls}>
        <CardHeader><CardTitle className="text-sm font-medium">Net by category</CardTitle></CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height={h}>
              <BarChart data={data}>
                <ChartDefs />
                <CartesianGrid {...c.grid} vertical={false} />
                <XAxis dataKey="name" {...c.axis} />
                <YAxis {...c.axis} tickFormatter={axisMoney} />
                <Tooltip {...c.tooltip} formatter={(v: number) => formatMoney(v)} cursor={{ fill: "hsl(var(--raised))", opacity: 0.4 }} />
                <Bar dataKey="value" name="Net" {...c.bar(1)} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8">No transaction data yet</p>
          )}
        </CardContent>
      </Card>
      <Card className={cardCls}>
        <CardHeader><CardTitle className="text-sm font-medium">Where the money goes</CardTitle></CardHeader>
        <CardContent>
          {spending.length > 0 ? (
            <ResponsiveContainer width="100%" height={h}>
              <PieChart>
                <ChartDefs />
                <Pie
                  data={spending} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={compact ? 70 : 85}
                  innerRadius={c.ui === "gtk4" || c.ui === "win11" ? 45 : 0}
                  stroke="hsl(var(--surface))" strokeWidth={c.ui === "winxp" ? 1 : 2}
                  isAnimationActive={c.cs.animateMs > 0} animationDuration={c.cs.animateMs}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                  fontSize={c.cs.fontSize}
                >
                  {spending.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip {...c.tooltip} formatter={(v: number) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8">No spending recorded yet</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
