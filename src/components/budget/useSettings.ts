import { useCallback, useEffect, useState } from "react";
import { databaseService, type Settings } from "@/lib/database";
import { DEFAULT_RATES } from "@/lib/finance";

const FALLBACK: Settings = { exchangeRates: { ...DEFAULT_RATES }, rwtRate: 10.5, interestBasis: "monthly" };

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(FALLBACK);

  const reload = useCallback(async () => {
    setSettings(await databaseService.getSettings());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { settings, reload };
}
