"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BaseRow,
  HabitLog,
  HubData,
} from "./types";
import { buildSeedData } from "./seed";
import { todayISO, uid } from "./utils";

const STORAGE_KEY = "emre-hub:data:v1";

/** Keys of HubData that hold arrays of rows (everything except `profile`). */
type ArrayKeys = {
  [K in keyof HubData]: HubData[K] extends BaseRow[] ? K : never;
}[keyof HubData];

type RowOf<K extends ArrayKeys> = HubData[K][number];

interface HubContextValue {
  data: HubData;
  ready: boolean;
  add: <K extends ArrayKeys>(
    collection: K,
    item: Omit<RowOf<K>, "id" | "created_at" | "updated_at"> &
      Partial<Pick<RowOf<K>, "id">>,
  ) => RowOf<K>;
  update: <K extends ArrayKeys>(
    collection: K,
    id: string,
    patch: Partial<RowOf<K>>,
  ) => void;
  remove: <K extends ArrayKeys>(collection: K, id: string) => void;
  setProfile: (patch: Partial<HubData["profile"]>) => void;
  toggleHabit: (habitId: string, date?: string) => void;
  reset: () => void;
}

const HubContext = createContext<HubContextValue | null>(null);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<HubData>(() => buildSeedData());
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  // Load persisted data on mount (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw) as HubData);
    } catch {
      // ignore corrupt storage, fall back to seed
    }
    hydrated.current = true;
    setReady(true);
  }, []);

  // Persist on change once hydrated.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full / unavailable — non-fatal
    }
  }, [data]);

  const add = useCallback<HubContextValue["add"]>((collection, item) => {
    const now = new Date().toISOString();
    const row = {
      id: uid(collection),
      created_at: now,
      updated_at: now,
      ...item,
    } as RowOf<typeof collection>;
    setData((prev) => ({
      ...prev,
      [collection]: [row, ...(prev[collection] as BaseRow[])],
    }));
    return row;
  }, []);

  const update = useCallback<HubContextValue["update"]>(
    (collection, id, patch) => {
      const now = new Date().toISOString();
      setData((prev) => ({
        ...prev,
        [collection]: (prev[collection] as BaseRow[]).map((r) =>
          r.id === id ? { ...r, ...patch, updated_at: now } : r,
        ),
      }));
    },
    [],
  );

  const remove = useCallback<HubContextValue["remove"]>((collection, id) => {
    setData((prev) => ({
      ...prev,
      [collection]: (prev[collection] as BaseRow[]).filter((r) => r.id !== id),
    }));
  }, []);

  const setProfile = useCallback<HubContextValue["setProfile"]>((patch) => {
    setData((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...patch, updated_at: new Date().toISOString() },
    }));
  }, []);

  const toggleHabit = useCallback<HubContextValue["toggleHabit"]>(
    (habitId, date) => {
      const log_date = date ?? todayISO();
      const now = new Date().toISOString();
      setData((prev) => {
        const existing = prev.habitLogs.find(
          (l) => l.habit_id === habitId && l.log_date === log_date,
        );
        let habitLogs: HabitLog[];
        if (existing) {
          habitLogs = prev.habitLogs.map((l) =>
            l.id === existing.id
              ? {
                  ...l,
                  completed: !l.completed,
                  count: l.completed ? 0 : 1,
                  updated_at: now,
                }
              : l,
          );
        } else {
          habitLogs = [
            {
              id: uid("hl"),
              user_id: prev.profile.user_id,
              habit_id: habitId,
              log_date,
              completed: true,
              count: 1,
              note: null,
              created_at: now,
              updated_at: now,
            },
            ...prev.habitLogs,
          ];
        }
        return { ...prev, habitLogs };
      });
    },
    [],
  );

  const reset = useCallback(() => {
    setData(buildSeedData());
  }, []);

  const value = useMemo<HubContextValue>(
    () => ({ data, ready, add, update, remove, setProfile, toggleHabit, reset }),
    [data, ready, add, update, remove, setProfile, toggleHabit, reset],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub(): HubContextValue {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error("useHub must be used within <HubProvider>");
  return ctx;
}
