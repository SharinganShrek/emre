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
import type { CollegeCounselingData } from "@/lib/college-counseling/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toast } from "@/lib/toast";

const STORAGE_KEY = "emre-hub:college:v1";

type CounselingContextValue = {
  data: CollegeCounselingData;
  loading: boolean;
  saving: boolean;
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
};

const CounselingContext = createContext<CounselingContextValue | null>(null);

function loadLocal(): CollegeCounselingData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(seedData);
    const parsed = JSON.parse(raw) as CollegeCounselingData;
    return { ...structuredClone(seedData), ...parsed };
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
  const [dirty, setDirty] = useState(false);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const dataRef = useRef(data);
  dataRef.current = data;

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
      value={{ data, loading, saving, dirty, source, setData, save, patch }}
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
