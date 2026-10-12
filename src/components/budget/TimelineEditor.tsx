import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  Calendar, Check, ChevronDown, ChevronRight, GraduationCap, Percent, Receipt, Repeat, RotateCcw, Undo2, Wand2, ZoomIn, ZoomOut, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMoney } from "@/lib/finance";
import type { EventOverride } from "@/lib/database";
import type { Keyframe, KeyframeKind, Range } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import { primaryBtnCls, inputCls } from "./styles";

export const KIND_ICON = { sub: Repeat, interest: Percent, tax: Receipt, loan: GraduationCap } as const;
const KIND_COLOR: Record<KeyframeKind, string> = {
  sub: "var(--chart-2)", interest: "var(--chart-1)", tax: "var(--chart-3)", loan: "var(--chart-4)",
};
const THUMB = 20;
const MARKER = 28;

const fmt = (d: string) => format(parseISO(d), "d MMM yyyy");

type Props = {
  range: Range;
  defRange: Range;
  keyframes: Keyframe[];
  overrides: Record<string, EventOverride>;
  applied: boolean;
  appliedRange?: Range;
  today: string;
  onRange: (r: Range) => void;
  onOverride: (key: string, patch: EventOverride | null) => void;
  onApply: () => void;
  onUnapply: () => void;
};

/**
 * The timeline dragger. Two handles pick the start and end (defaults: the account's first dated
 * activity and today). Every keyframe (subscription payment, interest credit, tax or loan
 * deduction) sits on its own lane as a large marker you can click to change its day.
 */
export default function TimelineEditor({ range, defRange, keyframes, overrides, applied, appliedRange, today, onRange, onOverride, onApply, onUnapply }: Props) {
  const [zoom, setZoom] = useState(false);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const [showList, setShowList] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // The scale: a little past the first activity and a year past today, or tight around the selection
  const domain = useMemo(() => {
    const lo = range.start < defRange.start ? range.start : defRange.start;
    const hi = range.end > today ? range.end : today;
    const spanSel = Math.max(7, differenceInCalendarDays(parseISO(range.end), parseISO(range.start)));
    if (zoom) {
      const pad = Math.max(2, Math.round(spanSel * 0.07));
      return { min: addDays(parseISO(range.start), -pad), days: spanSel + pad * 2 };
    }
    const spanAll = differenceInCalendarDays(parseISO(hi), parseISO(lo));
    const before = Math.max(30, Math.round(spanAll * 0.1));
    return { min: addDays(parseISO(lo), -before), days: spanAll + before + 365 };
  }, [range, defRange, today, zoom]);

  const idx = (d: string) => differenceInCalendarDays(parseISO(d), domain.min);
  const dateAt = (i: number) => format(addDays(domain.min, i), "yyyy-MM-dd");
  const values: [number, number] = drag ?? [idx(range.start), idx(range.end)];
  const leftPx = (i: number) => {
    const pct = (i / domain.days) * 100;
    return `calc(${pct}% + ${(THUMB / 2) * (1 - pct / 50)}px)`;
  };
  const pxAt = (i: number) => {
    const pct = (i / domain.days) * 100;
    return (pct / 100) * width + (THUMB / 2) * (1 - pct / 50);
  };

  const lanes = useMemo(() => {
    const map = new Map<string, { label: string; kind: KeyframeKind; items: Keyframe[] }>();
    for (const k of keyframes) {
      const lane = map.get(k.lane) ?? { label: k.laneLabel, kind: k.kind, items: [] };
      lane.items.push(k);
      map.set(k.lane, lane);
    }
    return [...map.entries()];
  }, [keyframes]);

  const pending =
    !applied || !appliedRange || appliedRange.start !== range.start || appliedRange.end !== range.end;
  const isDefault = range.start === defRange.start && range.end === defRange.end;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            <span className="block mb-1">Start</span>
            <Input type="date" value={range.start} max={range.end} onChange={(e) => e.target.value && onRange({ start: e.target.value, end: range.end })} className={cn(inputCls, "w-40 h-9")} />
          </label>
          <label className="text-xs text-muted-foreground">
            <span className="block mb-1">End</span>
            <Input type="date" value={range.end} min={range.start} onChange={(e) => e.target.value && onRange({ start: range.start, end: e.target.value })} className={cn(inputCls, "w-40 h-9")} />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => onRange(defRange)} disabled={isDefault} title="Start at the first dated activity, end today">
            <RotateCcw /> Defaults
          </Button>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setZoom((z) => !z)} title={zoom ? "Show the whole scale" : "Zoom to the selection so keyframes spread out"}>
          {zoom ? <ZoomOut /> : <ZoomIn />}{zoom ? "Zoom out" : "Zoom to selection"}
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="w-28 sm:w-36 shrink-0" aria-hidden />
        <div ref={trackRef} className="relative pt-1 flex-1 min-w-0">
        <SliderPrimitive.Root
          className="relative flex w-full touch-none select-none items-center h-8"
          min={0} max={domain.days} step={1} value={values} minStepsBetweenThumbs={0}
          onValueChange={(v) => setDrag([v[0], v[1]])}
          onValueCommit={(v) => { setDrag(null); onRange({ start: dateAt(v[0]), end: dateAt(v[1]) }); }}
          aria-label="Timeline range"
        >
          <SliderPrimitive.Track className="bt-slider-track relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
            <SliderPrimitive.Range className="absolute h-full bg-primary" />
          </SliderPrimitive.Track>
          {["Timeline start", "Timeline end"].map((label, i) => (
            <SliderPrimitive.Thumb
              key={label} aria-label={label}
              className="bt-slider-thumb block h-5 w-5 rounded-full border-2 border-primary bg-background cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ))}
        </SliderPrimitive.Root>
        <div className="relative h-5 text-[11px] text-muted-foreground tabular-nums" aria-hidden>
          <span className="absolute -translate-x-1/2" style={{ left: leftPx(values[0]) }}>{fmt(dateAt(values[0]))}</span>
          <span className="absolute -translate-x-1/2" style={{ left: leftPx(values[1]) }}>{values[1] - values[0] > 0 ? fmt(dateAt(values[1])) : ""}</span>
        </div>
        {idx(today) >= 0 && idx(today) <= domain.days && (
          <div className="absolute top-0 bottom-0 w-px bg-primary/40 pointer-events-none" style={{ left: leftPx(idx(today)) }} aria-hidden>
            <span className="absolute -top-0.5 left-1 text-[10px] text-primary">today</span>
          </div>
        )}
      </div>
      </div>

      <div className="space-y-2">
        {lanes.length === 0 ? (
          <p className="text-sm text-muted-foreground bt-row p-3">
            No keyframes in this range. Link subscriptions to this account (Subscriptions tab), add an interest rule (Interest tab), or add tax or student loan rules, then they appear here.
          </p>
        ) : (
          lanes.map(([lane, { label, kind, items }]) => {
            const Icon = KIND_ICON[kind];
            const sorted = [...items].sort((a, b) => idx(a.date) - idx(b.date));
            const minGap = sorted.reduce((m, k, i) => (i === 0 ? m : Math.min(m, pxAt(idx(k.date)) - pxAt(idx(sorted[i - 1].date)))), Infinity);
            const dense = minGap < MARKER - 2;
            return (
              <div key={lane} className="flex items-center gap-2">
                <div className="w-28 sm:w-36 shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground truncate" title={label}>
                  <Icon className="w-4 h-4 shrink-0" style={{ color: `hsl(${KIND_COLOR[kind]})` }} />
                  <span className="truncate">{label}</span>
                </div>
                <div className="relative h-9 flex-1 rounded-md bg-muted/50">
                  {sorted.map((k) => {
                    const left = leftPx(idx(k.date));
                    if (dense) {
                      return <span key={k.key} className="absolute top-2 bottom-2 w-0.5 -translate-x-1/2 rounded" style={{ left, background: `hsl(${KIND_COLOR[kind]})`, opacity: k.skipped ? 0.3 : 0.9 }} />;
                    }
                    return <Marker key={k.key} k={k} left={left} kind={kind} override={overrides[k.key]} onOverride={onOverride} />;
                  })}
                  {dense && (
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] text-foreground/70 pointer-events-none">
                      <span className="bg-card/80 rounded px-1.5">{sorted.length} keyframes · zoom in, or use the list</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowList((s) => !s)}>
          {showList ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          All keyframes ({keyframes.length})
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {applied && <Button type="button" variant="outline" size="sm" onClick={onUnapply}><Undo2 /> Remove from history</Button>}
          <Button type="button" className={primaryBtnCls} onClick={onApply} disabled={applied && !pending}>
            {applied && !pending ? <Check /> : <Wand2 />}
            {applied && !pending ? "Applied to the timeline" : applied ? "Update applied range" : "Apply keyframes to timeline"}
          </Button>
        </div>
      </div>

      {showList && (
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {keyframes.slice(0, 400).map((k) => (
            <div key={k.key} className={cn("bt-row flex flex-wrap items-center gap-3 px-3 py-1.5 text-sm", k.skipped && "opacity-60")}>
              <Input
                type="date" value={k.date} aria-label={`Day for ${k.label}`}
                onChange={(e) => e.target.value && onOverride(k.key, e.target.value === k.scheduled ? { date: undefined } : { date: e.target.value })}
                className={cn(inputCls, "w-40 h-8")}
              />
              <span className="flex-1 min-w-0 truncate">{k.label}</span>
              {k.amount !== undefined && <span className="tabular-nums text-muted-foreground">{formatMoney(k.amount)}</span>}
              <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => onOverride(k.key, { skip: !k.skipped })}>
                <Ban />{k.skipped ? "Restore" : "Skip"}
              </Button>
            </div>
          ))}
          {keyframes.length > 400 && <p className="text-xs text-muted-foreground text-center py-1">Showing the first 400. Narrow the range to see the rest.</p>}
        </div>
      )}
    </div>
  );
}

function Marker({
  k, left, kind, override, onOverride,
}: { k: Keyframe; left: string; kind: KeyframeKind; override?: EventOverride; onOverride: (key: string, patch: EventOverride | null) => void }) {
  const Icon = KIND_ICON[kind];
  const [open, setOpen] = useState(false);
  const moved = k.date !== k.scheduled;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`${k.label} · ${fmt(k.date)}${k.amount !== undefined ? ` · ${formatMoney(k.amount)}` : ""} (click to change the day)`}
          aria-label={`${k.label} on ${fmt(k.date)}. Change the day`}
          className={cn(
            "bt-kf absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-md border-2 text-white shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            k.skipped && "opacity-40"
          )}
          style={{
            left, width: MARKER, height: MARKER,
            background: k.skipped ? "transparent" : `hsl(${KIND_COLOR[kind]})`,
            borderColor: `hsl(${KIND_COLOR[kind]})`,
            color: k.skipped ? `hsl(${KIND_COLOR[kind]})` : "#fff",
            outline: moved ? "2px dashed hsl(var(--fg) / 0.7)" : undefined, outlineOffset: 1,
          }}
        >
          {k.skipped ? <Ban className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="center">
        <div>
          <div className="font-medium truncate">{k.label}</div>
          <div className="text-xs text-muted-foreground">
            Scheduled {fmt(k.scheduled)}{k.amount !== undefined && ` · ${formatMoney(k.amount)}`}
          </div>
        </div>
        <label className="block text-xs text-muted-foreground">
          <span className="flex items-center gap-1 mb-1"><Calendar className="w-3.5 h-3.5" />Day</span>
          <Input
            type="date" value={k.date} className={cn(inputCls, "h-9")}
            onChange={(e) => e.target.value && onOverride(k.key, e.target.value === k.scheduled ? { date: undefined } : { date: e.target.value })}
          />
        </label>
        <div className="flex gap-1">
          {[[-1, "−1 day"], [1, "+1 day"], [7, "+1 week"]].map(([d, label]) => (
            <Button key={label as string} type="button" variant="outline" size="sm" className="flex-1 px-1"
              onClick={() => onOverride(k.key, { date: format(addDays(parseISO(k.date), d as number), "yyyy-MM-dd") })}>
              {label}
            </Button>
          ))}
        </div>
        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={!override} onClick={() => onOverride(k.key, null)}><RotateCcw /> Reset</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { onOverride(k.key, { skip: !k.skipped }); setOpen(false); }}>
            <Ban />{k.skipped ? "Restore" : "Skip this one"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
