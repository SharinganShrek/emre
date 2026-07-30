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
import type { BaseRow, HabitLog, HubData } from "./types";
import { buildSeedData } from "./seed";
import { todayISO, uid } from "./utils";
import { isSupabaseConfigured } from "./supabase/config";
import {
  isSyncedCollection,
  type SyncedCollection,
  type SyncedHubPayload,
} from "./supabase/hub-repository";
import {
  LEGACY_STORAGE_KEY,
  buildGuestSupabaseHub,
  loadLocalOnlyData,
  mergeHubData,
  parseStoredHubData,
  saveLocalOnlyData,
} from "./local-data";

/** Keys of HubData that hold arrays of rows (everything except `profile`). */
type ArrayKeys = {
  [K in keyof HubData]: HubData[K] extends BaseRow[] ? K : never;
}[keyof HubData];

type RowOf<K extends ArrayKeys> = HubData[K][number];

export type HubSource = "local" | "supabase";

interface HubContextValue {
  data: HubData;
  ready: boolean;
  /** `local` = mock/localStorage; `supabase` = cloud sync via server API. */
  source: HubSource;
  userId: string | null;
  add: <K extends ArrayKeys>(
    collection: K,
    item: Omit<RowOf<K>, "id" | "created_at" | "updated_at"> &
      Partial<Pick<RowOf<K>, "id">>,
  ) => Promise<RowOf<K>>;
  update: <K extends ArrayKeys>(
    collection: K,
    id: string,
    patch: Partial<RowOf<K>>,
  ) => Promise<void>;
  remove: <K extends ArrayKeys>(collection: K, id: string) => Promise<void>;
  setProfile: (patch: Partial<HubData["profile"]>) => Promise<void>;
  toggleHabit: (habitId: string, date?: string) => Promise<void>;
  reset: () => void;
  refresh: () => Promise<void>;
  lock: () => Promise<void>;
}

const HubContext = createContext<HubContextValue | null>(null);

function newRowId(collection: ArrayKeys, source: HubSource): string {
  if (source === "supabase" && isSyncedCollection(collection)) {
    return crypto.randomUUID();
  }
  return uid(collection);
}

async function hubMutate(body: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/hub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? `Hub sync failed (${res.status})`);
  }
}

export function HubProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<HubData>(() => buildSeedData());
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<HubSource>("local");
  const [userId, setUserId] = useState<string | null>(null);

  const hydrated = useRef(false);
  const sourceRef = useRef<HubSource>("local");
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    sourceRef.current = source;
    userIdRef.current = userId;
  }, [source, userId]);

  const persistLocal = useCallback((next: HubData) => {
    if (!hydrated.current) return;
    try {
      if (sourceRef.current === "local") {
        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(next));
      } else {
        saveLocalOnlyData(next);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadSupabaseData = useCallback(async () => {
    const res = await fetch("/api/hub", { credentials: "same-origin" });
    if (res.status === 401) {
      if (typeof window !== "undefined" && window.location.pathname !== "/unlock") {
        window.location.replace("/unlock");
      }
      return;
    }
    if (res.status === 503) {
      setUserId(null);
      setData(buildGuestSupabaseHub(loadLocalOnlyData("guest")));
      return;
    }
    if (!res.ok) {
      throw new Error(`Failed to load hub data (${res.status})`);
    }
    const payload = (await res.json()) as SyncedHubPayload & {
      userId: string;
    };
    const uid = payload.userId;
    setUserId(uid);
    const localOnly = loadLocalOnlyData(uid);
    setData(mergeHubData(uid, payload, localOnly));
  }, []);

  const refresh = useCallback(async () => {
    if (sourceRef.current !== "supabase") return;
    await loadSupabaseData();
  }, [loadSupabaseData]);

  const lock = useCallback(async () => {
    await fetch("/api/unlock", { method: "DELETE" });
    window.location.href = "/unlock";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isSupabaseConfigured()) {
        setSource("local");
        sourceRef.current = "local";
        try {
          const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (raw) setData(parseStoredHubData(raw));
        } catch {
          /* ignore */
        }
        hydrated.current = true;
        if (!cancelled) setReady(true);
        return;
      }

      setSource("supabase");
      sourceRef.current = "supabase";

      try {
        await loadSupabaseData();
      } catch (err) {
        console.error("[hub] Supabase load failed, using empty synced state", err);
        setData(buildGuestSupabaseHub());
      }

      if (!cancelled) {
        hydrated.current = true;
        setReady(true);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loadSupabaseData]);

  useEffect(() => {
    persistLocal(data);
  }, [data, persistLocal]);

  const add = useCallback<HubContextValue["add"]>(async (collection, item) => {
    const now = new Date().toISOString();
    const row = {
      id: newRowId(collection, sourceRef.current),
      created_at: now,
      updated_at: now,
      ...item,
    } as RowOf<typeof collection>;

    setData((prev) => ({
      ...prev,
      [collection]: [row, ...(prev[collection] as BaseRow[])],
    }));

    if (
      sourceRef.current === "supabase" &&
      userIdRef.current &&
      isSyncedCollection(collection)
    ) {
      try {
        await hubMutate({
          action: "insert",
          collection: collection as SyncedCollection,
          row: row as unknown as Record<string, unknown>,
        });
      } catch (err) {
        setData((prev) => ({
          ...prev,
          [collection]: (prev[collection] as BaseRow[]).filter(
            (r) => r.id !== row.id,
          ),
        }));
        throw err;
      }
    }

    return row;
  }, []);

  const update = useCallback<HubContextValue["update"]>(
    async (collection, id, patch) => {
      const now = new Date().toISOString();
      let previous: RowOf<typeof collection> | undefined;

      setData((prev) => {
        const list = prev[collection] as BaseRow[];
        previous = list.find((r) => r.id === id) as
          | RowOf<typeof collection>
          | undefined;
        return {
          ...prev,
          [collection]: list.map((r) =>
            r.id === id ? { ...r, ...patch, updated_at: now } : r,
          ),
        };
      });

      if (
        sourceRef.current === "supabase" &&
        userIdRef.current &&
        isSyncedCollection(collection)
      ) {
        try {
          await hubMutate({
            action: "update",
            collection: collection as SyncedCollection,
            id,
            patch: patch as unknown as Record<string, unknown>,
          });
        } catch (err) {
          if (previous) {
            const rollback = previous;
            setData((prev) => ({
              ...prev,
              [collection]: (prev[collection] as BaseRow[]).map((r) =>
                r.id === id ? rollback : r,
              ),
            }));
          }
          throw err;
        }
      }
    },
    [],
  );

  const remove = useCallback<HubContextValue["remove"]>(
    async (collection, id) => {
      let removed: RowOf<typeof collection> | undefined;
      let index = -1;

      setData((prev) => {
        const list = prev[collection] as BaseRow[];
        index = list.findIndex((r) => r.id === id);
        removed = list[index] as RowOf<typeof collection> | undefined;
        return {
          ...prev,
          [collection]: list.filter((r) => r.id !== id),
        };
      });

      if (
        sourceRef.current === "supabase" &&
        userIdRef.current &&
        isSyncedCollection(collection)
      ) {
        try {
          await hubMutate({
            action: "delete",
            collection: collection as SyncedCollection,
            id,
          });
        } catch (err) {
          if (removed && index >= 0) {
            const row = removed;
            const at = index;
            setData((prev) => {
              const list = [...(prev[collection] as BaseRow[])];
              list.splice(at, 0, row);
              return { ...prev, [collection]: list };
            });
          }
          throw err;
        }
      }
    },
    [],
  );

  const setProfile = useCallback<HubContextValue["setProfile"]>(async (patch) => {
    let previous: HubData["profile"] | undefined;
    setData((prev) => {
      previous = prev.profile;
      return {
        ...prev,
        profile: {
          ...prev.profile,
          ...patch,
          updated_at: new Date().toISOString(),
        },
      };
    });

    if (sourceRef.current === "supabase" && userIdRef.current) {
      try {
        await hubMutate({ action: "updateProfile", patch });
      } catch (err) {
        if (previous) {
          const rollback = previous;
          setData((prev) => ({ ...prev, profile: rollback }));
        }
        throw err;
      }
    }
  }, []);

  const toggleHabit = useCallback<HubContextValue["toggleHabit"]>(
    async (habitId, date) => {
      const log_date = date ?? todayISO();
      const now = new Date().toISOString();
      let nextLog: HabitLog | null = null;
      let previousLogs: HabitLog[] | null = null;

      setData((prev) => {
        previousLogs = prev.habitLogs;
        const existing = prev.habitLogs.find(
          (l) => l.habit_id === habitId && l.log_date === log_date,
        );
        let habitLogs: HabitLog[];
        if (existing) {
          nextLog = {
            ...existing,
            completed: !existing.completed,
            count: existing.completed ? 0 : 1,
            updated_at: now,
          };
          habitLogs = prev.habitLogs.map((l) =>
            l.id === existing.id ? nextLog! : l,
          );
        } else {
          nextLog = {
            id: newRowId("habitLogs", sourceRef.current),
            user_id: prev.profile.user_id,
            habit_id: habitId,
            log_date,
            completed: true,
            count: 1,
            note: null,
            created_at: now,
            updated_at: now,
          };
          habitLogs = [nextLog, ...prev.habitLogs];
        }
        return { ...prev, habitLogs };
      });

      if (sourceRef.current === "supabase" && userIdRef.current && nextLog) {
        try {
          await hubMutate({ action: "upsertHabitLog", log: nextLog });
        } catch (err) {
          if (previousLogs) {
            const rollback = previousLogs;
            setData((prev) => ({ ...prev, habitLogs: rollback }));
          }
          throw err;
        }
      }
    },
    [],
  );

  const reset = useCallback(() => {
    if (sourceRef.current === "local") {
      setData(buildSeedData());
      return;
    }
    setData(
      buildGuestSupabaseHub(loadLocalOnlyData(userIdRef.current ?? "guest")),
    );
  }, []);

  const value = useMemo<HubContextValue>(
    () => ({
      data,
      ready,
      source,
      userId,
      add,
      update,
      remove,
      setProfile,
      toggleHabit,
      reset,
      refresh,
      lock,
    }),
    [
      data,
      ready,
      source,
      userId,
      add,
      update,
      remove,
      setProfile,
      toggleHabit,
      reset,
      refresh,
      lock,
    ],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub(): HubContextValue {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error("useHub must be used within <HubProvider>");
  return ctx;
}

export { isSupabaseConfigured } from "./supabase/config";
