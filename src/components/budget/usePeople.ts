import { useCallback, useEffect, useState } from "react";
import { databaseService, type Person } from "@/lib/database";

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);

  const reload = useCallback(async () => {
    const list = await databaseService.getAllPeople();
    setPeople([...list].sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Adds (or finds) a person and returns their id. */
  const add = useCallback(
    async (name: string) => {
      const id = await databaseService.addPerson(name);
      await reload();
      return id;
    },
    [reload]
  );

  const nameOf = useCallback(
    (id: number | undefined) => people.find((p) => p.id === id)?.name ?? "Unknown",
    [people]
  );

  return { people, reload, add, nameOf };
}
