import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError } from "@/utils/toast";
import type { Person } from "@/lib/database";
import { inputCls, triggerCls } from "./styles";

const NEW = "__new__";

type Props = {
  people: Person[];
  value: number | null;
  onChange: (id: number) => void;
  /** Creates (or finds) a person by name and returns their id. */
  onAdd: (name: string) => Promise<number>;
  placeholder?: string;
};

/** Dropdown of known people, with an "Add new person" option so the same person can be reselected. */
export default function PersonSelect({ people, value, onChange, onAdd, placeholder = "Select a person" }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const confirmAdd = async () => {
    if (!name.trim()) return showError("Please enter a name");
    try {
      onChange(await onAdd(name));
      setName("");
      setAdding(false);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to add person");
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
              confirmAdd();
            } else if (e.key === "Escape") {
              setAdding(false);
            }
          }}
          className={inputCls}
          placeholder="New person's name"
        />
        <Button type="button" onClick={confirmAdd}>Add</Button>
        <Button type="button" variant="outline" onClick={() => { setAdding(false); setName(""); }}>Cancel</Button>
      </div>
    );
  }

  return (
    <Select
      value={value !== null && people.some((p) => p.id === value) ? String(value) : ""}
      onValueChange={(v) => (v === NEW ? setAdding(true) : onChange(Number(v)))}
    >
      <SelectTrigger className={triggerCls}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {people.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
        {people.length > 0 && <SelectSeparator />}
        <SelectItem value={NEW}>
          <span className="flex items-center gap-2"><Plus className="w-3 h-3" />Add new person…</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
