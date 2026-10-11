import { useEffect, useState } from "react";
import { Coins, Tags, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { databaseService, type InterestBasis } from "@/lib/database";
import { useSettings } from "./useSettings";
import { usePeople } from "./usePeople";
import { useCategories } from "./useCategories";
import AppearanceCard from "./AppearanceCard";
import WallpaperCard from "./WallpaperCard";
import ManageList from "./ManageList";
import { Field, IconInput } from "./Field";
import Segmented from "./Segmented";
import { cardCls, primaryBtnCls } from "./styles";

export default function SettingsTab() {
  const { settings, reload } = useSettings();
  const { people, reload: reloadPeople, add: addPerson } = usePeople();
  const { categories, reload: reloadCategories, add: addCategory } = useCategories();
  const [usd, setUsd] = useState("");
  const [eur, setEur] = useState("");
  const [rwt, setRwt] = useState("");
  const [basis, setBasis] = useState<InterestBasis>("monthly");

  useEffect(() => {
    setUsd(String(settings.exchangeRates.USD));
    setEur(String(settings.exchangeRates.EUR));
    setRwt(String(settings.rwtRate));
    setBasis(settings.interestBasis);
  }, [settings]);

  const save = async () => {
    const u = Number(usd);
    const e = Number(eur);
    const r = Number(rwt);
    if (!(u > 0) || !(e > 0)) return showError("Exchange rates must be greater than zero");
    if (!(r >= 0 && r < 100)) return showError("Default RWT rate must be between 0 and 100");
    try {
      await databaseService.updateSettings({ exchangeRates: { USD: u, EUR: e }, rwtRate: r, interestBasis: basis });
      await reload();
      showSuccess("Settings saved");
    } catch {
      showError("Failed to save settings");
    }
  };

  return (
    <div className="bt-grid" style={{ ["--bt-col" as string]: "28rem" }}>
      <div className="bt-span"><AppearanceCard /></div>

      <Card className={cardCls}>
        <CardHeader><CardTitle className="flex items-center gap-2"><Coins className="w-5 h-5 text-primary" />Currency and tax</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <p className="text-sm text-muted-foreground">
              NZD is the display currency. Rates are set manually, saved in your .db export, and used to convert USD and EUR amounts into NZD.
            </p>
            <Field label="NZD/USD (1 NZD = ? USD)"><IconInput type="number" step="0.0001" min="0" value={usd} onChange={(e) => setUsd(e.target.value)} /></Field>
            <Field label="NZD/EUR (1 NZD = ? EUR)"><IconInput type="number" step="0.0001" min="0" value={eur} onChange={(e) => setEur(e.target.value)} /></Field>
            <Field label="Default RWT rate (%)"><IconInput type="number" step="0.1" min="0" value={rwt} onChange={(e) => setRwt(e.target.value)} /></Field>
            <Field label="Interest calculation" hint="Sets the default period of the interest calculator and how often new interest rules are credited. The rate itself is always a yearly rate.">
              <Segmented label="Interest calculation basis" compact value={basis} onChange={(v) => setBasis(v as InterestBasis)}
                options={[{ value: "monthly", label: "Monthly", hint: "Default: 1 month, credited monthly" }, { value: "yearly", label: "Yearly", hint: "1 year, credited yearly" }]} />
            </Field>
            <div className="flex justify-end"><Button type="submit" className={primaryBtnCls}>Save settings</Button></div>
          </form>
        </CardContent>
      </Card>

      <WallpaperCard />

      <ManageList
        title="People" icon={Users} noun="person" items={people}
        description="People you pick on debts and subscriptions. Renaming updates everywhere they appear. You can also add people from any person dropdown."
        onAdd={addPerson}
        onRename={async (id, name) => { await databaseService.renamePerson(id, name); await reloadPeople(); }}
        onDelete={async (id) => { await databaseService.deletePerson(id); await reloadPeople(); }}
        deleteHint="People who are still used by a debt or subscription can't be removed."
      />

      <ManageList
        title="Categories" icon={Tags} noun="category" items={categories}
        description="Categories for transactions and subscriptions. Pick one in any category dropdown, or add a new one on the spot. Renaming updates everything that uses it."
        onAdd={addCategory}
        onRename={async (id, name) => { await databaseService.renameCategory(id, name); await reloadCategories(); }}
        onDelete={async (id) => { await databaseService.deleteCategory(id); await reloadCategories(); }}
        deleteHint="Transactions and subscriptions that use it become uncategorised."
      />
    </div>
  );
}
