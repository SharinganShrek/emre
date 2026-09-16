"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { collegeCounselingData as seedData } from "@/lib/college-counseling/data";
import { mergeCollegeCounseling } from "@/lib/college-counseling/merge";
import type { CollegeCounselingData } from "@/lib/college-counseling/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toast } from "@/lib/toast";

const STORAGE_KEY = "emre-hub:college:v1";

type CounselingContextValue = {
  data: CollegeCounselingData;
  loading: boolean;
  saving: boolean;
  refreshing: boolean;
  dirty: boolean;
  source: "local" | "supabase";
  setData: (
    updater:
      | CollegeCounselingData
      | ((prev: CollegeCounselingData) => CollegeCounselingData),
  ) => void;
  save: () => Promise<void>;
  patch: <K extends keyof CollegeCounselingData>(
    key: K,
    value: CollegeCounselingData[K],
  ) => void;
  refresh: (opts?: { silent?: boolean }) => Promise<boolean>;
};

const CounselingContext = createContext<CounselingContextValue | null>(null);

function loadLocal(): CollegeCounselingData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(seedData);
    const parsed = JSON.parse(raw) as CollegeCounselingData;
    const merged = mergeCollegeCounseling(parsed);
    const droppedNeedAware = Array.isArray(parsed.schools)
      ? parsed.schools.some(
          (s) => (s as { group?: string }).group === "us_need_aware",
        )
      : false;
    if (
      (parsed.activities_seed_rev ?? 0) < (merged.activities_seed_rev ?? 0) ||
      droppedNeedAware ||
      parsed.counselor_todo == null
    ) {
      saveLocal(merged);
    }
    return merged;
  } catch {
    return structuredClone(seedData);
  }
}

function saveLocal(data: CollegeCounselingData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function CounselingProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<CollegeCounselingData>(() =>
    structuredClone(seedData),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const dataRef = useRef(data);
  const dirtyRef = useRef(false);
  const refreshInFlight = useRef(false);
  dataRef.current = data;
  dirtyRef.current = dirty;

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setDataState(loadLocal());
          setSource("local");
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch("/api/college-counseling");
        if (res.status === 503) {
          if (!cancelled) {
            setDataState(loadLocal());
            setSource("local");
          }
          return;
        }
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { data: CollegeCounselingData };
        if (!cancelled) {
          setDataState(json.data);
          setSource("supabase");
        }
      } catch {
        if (!cancelled) {
          setDataState(loadLocal());
          setSource("local");
          toast.error("Could not load counseling from server — using local");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const setData = useCallback(
    (
      updater:
        | CollegeCounselingData
        | ((prev: CollegeCounselingData) => CollegeCounselingData),
    ) => {
      setDataState((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      );
      setDirty(true);
    },
    [],
  );

  const patch = useCallback(
    <K extends keyof CollegeCounselingData>(
      key: K,
      value: CollegeCounselingData[K],
    ) => {
      setData((prev) => ({ ...prev, [key]: value }));
    },
    [setData],
  );

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!isSupabaseConfigured()) {
      if (!silent) toast.error("Server sync is not configured");
      return false;
    }
    if (dirtyRef.current) {
      if (!silent) toast.message("Save your changes before reloading");
      return false;
    }
    if (refreshInFlight.current) return false;
    refreshInFlight.current = true;
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/college-counseling");
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error ?? "Could not reload from server");
      }
      const json = (await res.json()) as { data: CollegeCounselingData };
      if (dirtyRef.current) {
        if (!silent) toast.message("Skipped reload — you have unsaved changes");
        return false;
      }
      setDataState(json.data);
      setSource("supabase");
      if (!silent) toast.success("Reloaded from server");
      return true;
    } catch (err) {
      if (!silent) {
        toast.error(
          err instanceof Error ? err.message : "Could not reload from server",
        );
      }
      return false;
    } finally {
      refreshInFlight.current = false;
      if (!silent) setRefreshing(false);
    }
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    const payload = dataRef.current;
    try {
      if (source === "supabase") {
        const res = await fetch("/api/college-counseling", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(err?.error ?? "Save failed");
        }
      } else {
        saveLocal(payload);
      }
      setDirty(false);
      toast.success(
        source === "supabase"
          ? "College counseling saved"
          : "Saved locally (browser)",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [source]);

  return (
    <CounselingContext.Provider
      value={{
        data,
        loading,
        saving,
        refreshing,
        dirty,
        source,
        setData,
        save,
        patch,
        refresh,
      }}
    >
      {children}
    </CounselingContext.Provider>
  );
}

export function useCounseling() {
  const ctx = useContext(CounselingContext);
  if (!ctx) {
    throw new Error("useCounseling must be used within CounselingProvider");
  }
  return ctx;
}
