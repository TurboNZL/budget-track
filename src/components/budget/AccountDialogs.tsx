import { useEffect, useState } from "react";
import { Landmark, Lock, LockOpen, Plus, Save, Scale } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { showError, showSuccess } from "@/utils/toast";
import { databaseService, type Account } from "@/lib/database";
import { formatMoney } from "@/lib/finance";
import EntryDialog from "./EntryDialog";
import { Field, IconInput } from "./Field";

export function AccountDialog({
  open, onOpenChange, editing, onSaved,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing?: Account | null; onSaved: (id: number) => void }) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName(editing?.name ?? "");
  }, [open, editing]);

  const save = async () => {
    const clean = name.trim();
    if (!clean) return showError("Account name cannot be empty");
    try {
      let id: number;
      if (editing) {
        await databaseService.updateAccount(editing.id, clean);
        id = editing.id;
      } else {
        id = await databaseService.addAccount(clean);
      }
      showSuccess(editing ? "Account renamed" : "Account added");
      onSaved(id);
      onOpenChange(false);
    } catch {
      showError("Failed to save the account");
    }
  };

  return (
    <EntryDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Landmark}
      title={editing ? "Rename account" : "Add account"}
      description={editing ? undefined : 'Give the account a name, e.g. "Everyday" or "Savings".'}
      submitLabel={editing ? "Save" : "Add account"}
      submitIcon={editing ? Save : Plus}
      onSubmit={save}
    >
      <Field label="Account name">
        <IconInput icon={Landmark} data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" />
      </Field>
    </EntryDialog>
  );
}

export function BalanceDialog({
  account, accounted, onClose, onSaved,
}: { account: Account | null; accounted: number; onClose: () => void; onSaved: () => void }) {
  const [input, setInput] = useState("");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (account) {
      setInput((accounted + account.unaccounted).toFixed(2));
      setLocked(account.locked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  const target = Number(input);
  const valid = input.trim() !== "" && Number.isFinite(target);
  const diff = valid ? Math.round((target - accounted) * 100) / 100 : 0;

  const save = async () => {
    if (!account || !valid) return showError("Please enter a valid balance");
    try {
      await databaseService.setAccountBalance(account.id, target, locked);
      showSuccess(locked ? "Balance set and locked" : "Balance updated");
      onSaved();
      onClose();
    } catch {
      showError("Failed to set the balance");
    }
  };

  return (
    <EntryDialog
      open={account !== null}
      onOpenChange={(o) => !o && onClose()}
      icon={Scale}
      title={account ? `Set balance: ${account.name}` : "Set balance"}
      description="Enter what the account holds right now. Anything your transactions don't explain is kept as an undated amount that still counts toward the balance."
      submitLabel="Save balance"
      submitIcon={Save}
      onSubmit={save}
    >
      <Field label="Current balance">
        <IconInput symbol="$" data-autofocus type="number" inputMode="decimal" step="0.01" value={input} onChange={(e) => setInput(e.target.value)} className="text-lg font-semibold tabular-nums" />
      </Field>
      <label className="bt-row flex items-start gap-3 p-3 cursor-pointer">
        <Switch checked={locked} onCheckedChange={setLocked} className="mt-0.5" aria-label="Lock balance" />
        <span className="text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            {locked ? <Lock className="w-4 h-4 text-primary" /> : <LockOpen className="w-4 h-4 text-muted-foreground" />}
            Keep this balance locked
          </span>
          <span className="text-muted-foreground">
            Transactions you add, edit or delete afterwards won't change the balance. The difference is absorbed by the undated amount.
          </span>
        </span>
      </label>
      <div className="text-sm text-muted-foreground space-y-1">
        <div>Accounted for by transactions: <span className="text-foreground">{formatMoney(accounted)}</span></div>
        {valid && (
          <div>
            {diff > 0 ? "Unaccounted for income" : diff < 0 ? "Unaccounted for spending" : "Unaccounted"}:{" "}
            <span className="text-foreground">{formatMoney(diff)}</span>
          </div>
        )}
      </div>
    </EntryDialog>
  );
}
