import type { CSSProperties } from "react";
import { useAppearance } from "@/lib/themes";

/**
 * Chart look per UI style, so graphs match the rest of the interface: corner shapes, bar finish,
 * grid lines, tooltips and animation all follow the selected style. Colours come from the theme's
 * --chart-N variables.
 */
export type ChartStyle = {
  barRadius: number;
  /** flat colour, glossy Aero highlight, or a bevelled Luna look */
  finish: "flat" | "gloss" | "bevel" | "outline";
  grid: string;
  gridOpacity: number;
  lineWidth: number;
  dot: "round" | "square";
  animateMs: number;
  easing: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear";
  fontSize: number;
  tooltip: CSSProperties;
};

const base: CSSProperties = {
  backgroundColor: "hsl(var(--surface))",
  border: "1px solid hsl(var(--line))",
  color: "hsl(var(--fg))",
  borderRadius: 8,
};

const STYLES: Record<string, ChartStyle> = {
  default: { barRadius: 4, finish: "flat", grid: "3 3", gridOpacity: 1, lineWidth: 2, dot: "round", animateMs: 500, easing: "ease-out", fontSize: 12, tooltip: base },
  gtk4: { barRadius: 8, finish: "flat", grid: "0", gridOpacity: 0.5, lineWidth: 3, dot: "round", animateMs: 700, easing: "ease-in-out", fontSize: 12, tooltip: { ...base, borderRadius: 12, border: "0", boxShadow: "0 2px 12px rgb(0 0 0 / 0.35)" } },
  breeze: { barRadius: 2, finish: "outline", grid: "1 3", gridOpacity: 1, lineWidth: 1.5, dot: "round", animateMs: 300, easing: "ease-in-out", fontSize: 11, tooltip: { ...base, borderRadius: 3, boxShadow: "0 2px 6px rgb(0 0 0 / 0.35)" } },
  win11: { barRadius: 4, finish: "flat", grid: "0", gridOpacity: 0.7, lineWidth: 2.5, dot: "round", animateMs: 600, easing: "ease-out", fontSize: 12, tooltip: { ...base, borderRadius: 8, boxShadow: "0 8px 20px rgb(0 0 0 / 0.3)" } },
  win10: { barRadius: 0, finish: "flat", grid: "0", gridOpacity: 0.8, lineWidth: 2, dot: "square", animateMs: 250, easing: "linear", fontSize: 12, tooltip: { ...base, borderRadius: 0, borderWidth: 2 } },
  win7: { barRadius: 3, finish: "gloss", grid: "0", gridOpacity: 0.9, lineWidth: 2, dot: "round", animateMs: 800, easing: "ease-out", fontSize: 12, tooltip: { ...base, borderRadius: 4, background: "linear-gradient(to bottom, hsl(var(--surface)), color-mix(in srgb, hsl(var(--accent)) 15%, hsl(var(--surface))))", boxShadow: "3px 3px 5px rgb(0 0 0 / 0.35)" } },
  win98: { barRadius: 0, finish: "bevel", grid: "0", gridOpacity: 1, lineWidth: 2, dot: "square", animateMs: 0, easing: "linear", fontSize: 11, tooltip: { backgroundColor: "#ffffe1", color: "#000", border: "1px solid #000", borderRadius: 0, fontSize: 11 } },
  macos: { barRadius: 5, finish: "flat", grid: "0", gridOpacity: 0.6, lineWidth: 2.5, dot: "round", animateMs: 600, easing: "ease-out", fontSize: 12, tooltip: { ...base, borderRadius: 10, border: "0", boxShadow: "0 6px 24px rgb(0 0 0 / 0.28)" } },
  material: { barRadius: 8, finish: "flat", grid: "0", gridOpacity: 0.5, lineWidth: 3, dot: "round", animateMs: 500, easing: "ease-in-out", fontSize: 12, tooltip: { ...base, borderRadius: 12, border: "0", boxShadow: "0 3px 10px rgb(0 0 0 / 0.3)" } },
  winxp: { barRadius: 0, finish: "bevel", grid: "0", gridOpacity: 1, lineWidth: 2, dot: "square", animateMs: 0, easing: "linear", fontSize: 11, tooltip: { backgroundColor: "#ffffe1", color: "#000", border: "1px solid #000", borderRadius: 0, fontSize: 11 } },
};

export const CHART_COLORS = [1, 2, 3, 4, 5, 6].map((n) => `hsl(var(--chart-${n}))`);
export const AXIS = "hsl(var(--muted))";
export const GRID = "hsl(var(--line))";
export const NEGATIVE = "hsl(var(--bad))";
export const POSITIVE = "hsl(var(--good))";

/** UI styles with no chart look of their own borrow the closest family's. */
const CHART_FAMILY: Record<string, string> = { aqua: "macos", liquid: "macos", yaru: "gtk4", oneui: "material" };

export const getChartStyle = (ui: string): ChartStyle => STYLES[ui] ?? STYLES[CHART_FAMILY[ui]] ?? STYLES.default;

export function useChartStyle() {
  const { ui } = useAppearance();
  const cs = getChartStyle(ui);
  return {
    ui,
    cs,
    /** Fill for series number n (1-6): a gradient reference for glossy / bevelled styles. */
    fill: (n: number) => (cs.finish === "gloss" || cs.finish === "bevel" ? `url(#bt-${cs.finish}-${n})` : `hsl(var(--chart-${n}))`),
    /** Extra props for <Bar>. */
    bar: (n: number) => ({
      fill: cs.finish === "gloss" || cs.finish === "bevel" ? `url(#bt-${cs.finish}-${n})` : cs.finish === "outline" ? `hsl(var(--chart-${n}) / 0.35)` : `hsl(var(--chart-${n}))`,
      stroke: cs.finish === "bevel" ? "var(--xp-frame, #404040)" : cs.finish === "outline" ? `hsl(var(--chart-${n}))` : cs.finish === "gloss" ? `hsl(var(--chart-${n}))` : "none",
      strokeWidth: cs.finish === "flat" ? 0 : 1,
      radius: [cs.barRadius, cs.barRadius, cs.barRadius, cs.barRadius] as [number, number, number, number],
      animationDuration: cs.animateMs,
      animationEasing: cs.easing,
      isAnimationActive: cs.animateMs > 0,
    }),
    line: (n: number, dashed = false) => ({
      stroke: `hsl(var(--chart-${n}))`,
      strokeWidth: cs.lineWidth,
      strokeDasharray: dashed ? "6 4" : undefined,
      animationDuration: cs.animateMs,
      animationEasing: cs.easing,
      isAnimationActive: cs.animateMs > 0,
    }),
    grid: { stroke: GRID, strokeDasharray: cs.grid, strokeOpacity: cs.gridOpacity },
    axis: { stroke: AXIS, fontSize: cs.fontSize },
    tooltip: { contentStyle: cs.tooltip, labelStyle: { color: "inherit", fontWeight: 600 }, itemStyle: { color: "inherit" } },
  };
}

/** Gradient definitions for the glossy / bevelled bar finishes. Put inside a chart. */
export function ChartDefs({ ui, prefix = "bt" }: { ui?: string; prefix?: string } = {}) {
  const current = useChartStyle();
  const cs = ui ? getChartStyle(ui) : current.cs;
  if (cs.finish !== "gloss" && cs.finish !== "bevel") return null;
  return (
    <defs>
      {[1, 2, 3, 4, 5, 6].map((n) => {
        const c = `hsl(var(--chart-${n}))`;
        return cs.finish === "gloss" ? (
          <linearGradient key={n} id={`${prefix}-gloss-${n}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${c} 55%, white)` }} />
            <stop offset="0.5" style={{ stopColor: `color-mix(in srgb, ${c} 85%, white)` }} />
            <stop offset="0.52" style={{ stopColor: c }} />
            <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${c} 80%, black)` }} />
          </linearGradient>
        ) : (
          <linearGradient key={n} id={`${prefix}-bevel-${n}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${c} 55%, white)` }} />
            <stop offset="0.25" style={{ stopColor: c }} />
            <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${c} 72%, black)` }} />
          </linearGradient>
        );
      })}
    </defs>
  );
}
