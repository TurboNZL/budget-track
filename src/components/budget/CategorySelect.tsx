import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError } from "@/utils/toast";
import type { Category } from "@/lib/database";
import { inputCls, triggerCls } from "./styles";

const NEW = "__new__";
const NONE = "__none__";

type Props = {
  categories: Category[];
  value: string;
  onChange: (name: string) => void;
  /** Creates (or finds) a category by name and returns its name. */
  onAdd: (name: string) => Promise<string>;
};

/** Pick a saved category or add a new one in place, the same way people are picked. */
export default function CategorySelect({ categories, value, onChange, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const confirmAdd = async () => {
    if (!name.trim()) return showError("Please enter a category name");
    try {
      onChange(await onAdd(name));
      setName("");
      setAdding(false);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to add category");
    }
  };

  if (adding) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              confirmAdd();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              setAdding(false);
            }
          }}
          className={inputCls}
          placeholder="New category"
        />
        <Button type="button" onClick={confirmAdd}>Add</Button>
        <Button type="button" variant="outline" onClick={() => { setAdding(false); setName(""); }}>Cancel</Button>
      </div>
    );
  }

  const known = categories.some((c) => c.name === value);
  return (
    <Select
      value={value && known ? value : NONE}
      onValueChange={(v) => (v === NEW ? setAdding(true) : onChange(v === NONE ? "" : v))}
    >
      <SelectTrigger className={triggerCls}><SelectValue placeholder="No category" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No category</SelectItem>
        {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
        <SelectSeparator />
        <SelectItem value={NEW}>
          <span className="flex items-center gap-2"><Plus className="w-3 h-3" />Add new category…</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
