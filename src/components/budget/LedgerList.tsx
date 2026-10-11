import { useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { ArrowDownToLine, ArrowUpToLine, ArrowDown, ArrowUp, Ban, Equal, GripVertical, Scale, Sigma } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMoney, ROUNDING_OPTIONS, type Rounding } from "@/lib/finance";
import type { LedgerRow } from "@/lib/ledger";
import { cn } from "@/lib/utils";
import IconButton from "./IconButton";
import Segmented from "./Segmented";
import { KIND_ICON } from "./TimelineEditor";
import { TYPE_OPTIONS } from "./TransactionDialog";

const PAGE_DAYS = 45;
const ROUND_ICON = { nearest: Equal, down: ArrowDownToLine, up: ArrowUpToLine } as const;
const KIND_LABEL = { sub: "Subscription", interest: "Interest", tax: "Tax", loan: "Loan" } as const;

type Props = {
  rows: LedgerRow[];
  newestFirst: boolean;
  onReorder: (date: string, keys: string[]) => void;
  onRounding: (key: string, rounding: Rounding) => void;
  onSkip: (key: string) => void;
};

const precise = (n: number) => {
  const s = Math.abs(n).toFixed(6).replace(/0+$/, "");
  return s.endsWith(".") ? s + "00" : s;
};

function RoundingControl({ row, onRounding }: { row: LedgerRow; onRounding: (key: string, r: Rounding) => void }) {
  const mode = row.rounding ?? "nearest";
  const Icon = ROUND_ICON[mode];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" title="Exact value and rounding" aria-label={`Rounding for ${row.label}: ${mode}`}
          className="h-7 px-1.5 rounded-md text-xs text-muted-foreground hover:text-primary hover:bg-accent flex items-center gap-1">
          <Icon className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="text-sm">
          <div className="font-medium">{row.label}</div>
          <div className="text-xs text-muted-foreground">
            Exact amount {row.rawAmount !== undefined && precise(row.rawAmount)}, shown as {formatMoney(Math.abs(row.amount))}.
          </div>
        </div>
        <Segmented label="Rounding" compact value={mode} onChange={(r) => onRounding(row.key, r)}
          options={ROUNDING_OPTIONS.map((o) => ({ value: o.id, label: { nearest: "Nearest", down: "Down", up: "Up" }[o.id], icon: ROUND_ICON[o.id], hint: o.label }))} />
        <p className="text-xs text-muted-foreground">Fixes a single entry that was rounded the wrong way. Rule-wide rounding is set on the rule itself.</p>
      </PopoverContent>
    </Popover>
  );
}

function Row({ row, sortable, onRounding }: { row: LedgerRow; sortable: boolean; onRounding: (key: string, r: Rounding) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.key, disabled: !sortable });
  const kind = row.kind;
  const Icon =
    kind === "tx"
      ? (TYPE_OPTIONS.find((o) => o.value === row.detail)?.icon ?? Scale)
      : kind === "opening" ? Scale : KIND_ICON[kind];
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      className={cn(
        "bt-row grid grid-cols-[1.5rem_1.5rem_minmax(0,1fr)_auto_auto] md:grid-cols-[1.5rem_1.5rem_minmax(0,2fr)_minmax(0,1fr)_auto_7rem_auto] items-center gap-2 px-2 py-2",
        isDragging && "shadow-lg ring-1 ring-primary", row.memo && "opacity-70"
      )}
    >
      {sortable ? (
        <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Drag to reorder ${row.label}`} title="Drag to reorder (or focus and press Space, then the arrow keys)"
          className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex items-center justify-center h-7">
          <GripVertical className="w-4 h-4" />
        </button>
      ) : <span />}
      <Icon className={cn("w-4 h-4", row.amount > 0 ? "text-positive" : row.amount < 0 ? "text-negative" : "text-muted-foreground")} aria-hidden />
      <div className="min-w-0">
        <div className="font-medium truncate flex items-center gap-1.5">
          {row.label}
          {row.generated && kind !== "tx" && kind !== "opening" && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide rounded px-1 py-0.5 bg-primary/15 text-primary">{KIND_LABEL[kind]}</span>
          )}
          {row.memo && <span className="shrink-0 text-[10px] uppercase tracking-wide rounded px-1 py-0.5 bg-muted text-muted-foreground">memo</span>}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {kind === "tx" ? row.category : row.detail}
          {row.memo && row.rawAmount !== undefined && ` · ${formatMoney(Math.abs(row.rawAmount))} deducted`}
          {row.scheduledDate && row.scheduledDate !== row.date && ` · scheduled ${format(parseISO(row.scheduledDate), "d MMM")}`}
        </div>
      </div>
      <span className="hidden md:block text-sm text-muted-foreground truncate">{kind === "tx" ? row.category : ""}</span>
      <div className="flex items-center justify-end">
        {row.generated && !row.memo && row.roundable && <RoundingControl row={row} onRounding={onRounding} />}
      </div>
      <div className="text-right tabular-nums">
        <div className={cn("font-medium", row.amount > 0 ? "text-positive" : row.amount < 0 ? "text-negative" : "")}>
          {row.memo ? "–" : `${row.amount >= 0 ? "+" : "-"}${formatMoney(Math.abs(row.amount))}`}
        </div>
        <div className="text-xs text-muted-foreground md:hidden">{formatMoney(row.balance)}</div>
      </div>
      <div className="hidden md:flex items-center justify-end">
        <span className="tabular-nums text-sm text-muted-foreground w-24 text-right">{formatMoney(row.balance)}</span>
      </div>
    </div>
  );
}

export default function LedgerList({ rows, newestFirst, onReorder, onRounding, onSkip }: Props) {
  const [days, setDays] = useState(PAGE_DAYS);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { opening, groups } = useMemo(() => {
    const opening = rows.find((r) => r.kind === "opening");
    const byDay = new Map<string, LedgerRow[]>();
    for (const r of rows) {
      if (r.kind === "opening") continue;
      byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
    }
    const ordered = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (newestFirst) ordered.reverse();
    return { opening, groups: ordered };
  }, [rows, newestFirst]);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = active.data.current?.sortable?.containerId as string | undefined;
    const to = over.data.current?.sortable?.containerId as string | undefined;
    if (!from || from !== to) {
      toast("Rows can only be reordered within the same day. Change the date to move one further.");
      return;
    }
    const keys = groups.find(([d]) => d === from)?.[1].map((r) => r.key) ?? [];
    const next = arrayMove(keys, keys.indexOf(String(active.id)), keys.indexOf(String(over.id)));
    onReorder(from, next);
  };

  const move = (date: string, key: string, dir: -1 | 1) => {
    const keys = groups.find(([d]) => d === date)?.[1].map((r) => r.key) ?? [];
    const i = keys.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= keys.length) return;
    onReorder(date, arrayMove(keys, i, j));
  };

  if (groups.length === 0 && !opening) return <p className="text-muted-foreground text-center py-8">No activity on this account yet</p>;

  return (
    <div className="space-y-4">
      {opening && opening.amount !== 0 && (
        <div className="bt-row px-3 py-2 flex items-center justify-between gap-3 text-sm" style={{ borderStyle: "dashed" }}>
          <span className="flex items-center gap-2"><Scale className="w-4 h-4 text-muted-foreground" />Unaccounted for (undated)</span>
          <span className="tabular-nums">{formatMoney(opening.amount)}</span>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {groups.slice(0, days).map(([date, list]) => {
          const net = list.reduce((s, r) => s + r.amount, 0);
          const sortable = list.length > 1;
          return (
            <section key={date} aria-label={format(parseISO(date), "d MMMM yyyy")} className="space-y-1.5">
              <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
                <span>{format(parseISO(date), "EEEE d MMMM yyyy")}</span>
                <span className="flex items-center gap-1 tabular-nums"><Sigma className="w-3 h-3" />{net >= 0 ? "+" : "-"}{formatMoney(Math.abs(net))}</span>
              </div>
              <SortableContext id={date} items={list.map((r) => r.key)} strategy={verticalListSortingStrategy}>
                {list.map((r, i) => (
                  <div key={r.key} className="group relative">
                    <Row row={r} sortable={sortable} onRounding={onRounding} />
                    <div className="absolute right-1 top-1 hidden group-hover:flex group-focus-within:flex items-center rounded-md bg-card/95 shadow-sm">
                      {sortable && <IconButton icon={ArrowUp} label="Move up" disabled={i === 0} onClick={() => move(date, r.key, -1)} className="h-6 w-6" />}
                      {sortable && <IconButton icon={ArrowDown} label="Move down" disabled={i === list.length - 1} onClick={() => move(date, r.key, 1)} className="h-6 w-6" />}
                      {r.generated && <IconButton icon={Ban} tone="danger" label="Skip this entry" onClick={() => onSkip(r.key)} className="h-6 w-6" />}
                    </div>
                  </div>
                ))}
              </SortableContext>
            </section>
          );
        })}
      </DndContext>
      {groups.length > days && (
        <div className="text-center"><Button variant="outline" onClick={() => setDays((d) => d + PAGE_DAYS)}>Show more days ({groups.length - days} left)</Button></div>
      )}
    </div>
  );
}
