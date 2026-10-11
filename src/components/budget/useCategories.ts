import { useCallback, useEffect, useState } from "react";
import { databaseService, type Category } from "@/lib/database";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  const reload = useCallback(async () => {
    const list = await databaseService.getAllCategories();
    setCategories([...list].sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Adds (or finds) a category and returns its name. */
  const add = useCallback(
    async (name: string) => {
      const clean = await databaseService.addCategory(name);
      await reload();
      return clean;
    },
    [reload]
  );

  return { categories, reload, add };
}
