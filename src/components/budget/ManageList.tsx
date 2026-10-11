import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError } from "@/utils/toast";
import ConfirmDialog from "./ConfirmDialog";
import IconButton from "./IconButton";
import { cardCls, inputCls } from "./styles";
import type { LucideIcon } from "lucide-react";

type Item = { id: number; name: string };

/** Add / rename / remove for a simple named list (people, categories). */
export default function ManageList({
  title, icon: Icon, description, noun, items, onAdd, onRename, onDelete, deleteHint,
}: {
  title: string;
  icon: LucideIcon;
  description: string;
  noun: string;
  items: Item[];
  onAdd: (name: string) => Promise<unknown>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  deleteHint?: string;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState("");
  const [deleting, setDeleting] = useState<Item | null>(null);

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    try {
      await fn();
      return true;
    } catch (e) {
      showError(e instanceof Error ? e.message : fallback);
      return false;
    }
  };

  const add = async () => {
    if (!adding.trim()) return;
    if (await run(() => onAdd(adding), `Failed to add ${noun}`)) setAdding("");
  };

  return (
    <Card className={cardCls}>
      <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="w-5 h-5 text-primary" />{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{description}</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <Input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={`Add a ${noun}`} aria-label={`New ${noun}`} className={inputCls} />
          <Button type="submit" disabled={!adding.trim()}><Plus /> Add</Button>
        </form>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No {noun}s yet</p>
        ) : (
          items.map((p) => (
            <div key={p.id} className="bt-row flex items-center justify-between gap-2 p-2.5">
              {editingId === p.id ? (
                <>
                  <Input
                    autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="New name" className={inputCls}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && (await run(() => onRename(p.id, name), "Failed to rename"))) setEditingId(null);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <IconButton icon={Check} label="Save name" onClick={async () => (await run(() => onRename(p.id, name), "Failed to rename")) && setEditingId(null)} />
                  <IconButton icon={X} label="Cancel" onClick={() => setEditingId(null)} />
                </>
              ) : (
                <>
                  <span className="font-medium truncate">{p.name}</span>
                  <div className="flex items-center">
                    <IconButton icon={Pencil} label={`Rename ${p.name}`} onClick={() => { setEditingId(p.id); setName(p.name); }} />
                    <IconButton icon={Trash2} tone="danger" label={`Remove ${p.name}`} onClick={() => setDeleting(p)} />
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </CardContent>
      <ConfirmDialog
        open={deleting !== null}
        title={`Remove ${deleting?.name}?`}
        description={deleteHint}
        confirmLabel="Remove"
        onConfirm={async () => { if (deleting && (await run(() => onDelete(deleting.id), "Failed to remove"))) setDeleting(null); else setDeleting(null); }}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  );
}
