import { ArrowDownToLine, ArrowUpToLine, Equal } from "lucide-react";
import { ROUNDING_OPTIONS, type Rounding } from "@/lib/finance";
import Segmented from "./Segmented";

const ICONS = { nearest: Equal, down: ArrowDownToLine, up: ArrowUpToLine } as const;
const SHORT = { nearest: "Nearest", down: "Down", up: "Up" } as const;

/** How cents are rounded when this rule's amount isn't a whole number of cents. */
export default function RoundingSelect({ value, onChange }: { value: Rounding; onChange: (r: Rounding) => void }) {
  return (
    <Segmented
      label="Rounding"
      value={value}
      onChange={onChange}
      compact
      options={ROUNDING_OPTIONS.map((o) => ({ value: o.id, label: SHORT[o.id], icon: ICONS[o.id], hint: o.label }))}
    />
  );
}
