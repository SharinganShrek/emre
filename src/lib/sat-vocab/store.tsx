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
import {
  mergeProgress,
  progressSummary,
  recomputeCompletedDates,
  satVocabData,
} from "@/lib/sat-vocab";
import type {
  SatDrillType,
  SatSessionProgress,
  SatVocabProgress,
} from "@/lib/sat-vocab/types";
import { todayISO } from "@/lib/utils";
import { stampActivityDate } from "@/lib/sat-vocab/streak";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toast } from "@/lib/toast";

const STORAGE_KEY = "emre-hub:sat-vocab:v1";

type SatVocabContextValue = {
  progress: SatVocabProgress;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  source: "local" | "supabase";
  summary: ReturnType<typeof progressSummary>;
  setProgress: (
    updater:
      | SatVocabProgress
      | ((prev: SatVocabProgress) => SatVocabProgress),
  ) => void;
  save: () => Promise<void>;
  markLearned: (planId: string, knownWords?: string[]) => void;
  markTested: (planId: string, drill: SatDrillType, score: number) => void;
  recordWordResult: (word: string, correct: boolean) => void;
  markRestDone: (planId: string) => void;
};

const SatVocabContext = createContext<SatVocabContextValue | null>(null);

function loadLocal(): SatVocabProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mergeProgress(null);
    return mergeProgress(JSON.parse(raw) as Partial<SatVocabProgress>);
  } catch {
    return mergeProgress(null);
  }
}

function saveLocal(data: SatVocabProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function withCompleted(p: SatVocabProgress): SatVocabProgress {
  const activity_dates = recomputeCompletedDates({
    ...p,
    activity_dates: p.activity_dates ?? [],
  });
  return { ...p, activity_dates, completed_dates: activity_dates };
}

export function SatVocabProvider({ children }: { children: ReactNode }) {
  const [progress, setProgressState] = useState<SatVocabProgress>(() =>
    mergeProgress(null),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setProgressState(withCompleted(loadLocal()));
          setSource("local");
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch("/api/sat-vocab");
        if (res.status === 503) {
          if (!cancelled) {
            setProgressState(withCompleted(loadLocal()));
            setSource("local");
          }
          return;
        }
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { data: SatVocabProgress };
        if (!cancelled) {
          setProgressState(withCompleted(mergeProgress(json.data)));
          setSource("supabase");
        }
      } catch {
        if (!cancelled) {
          setProgressState(withCompleted(loadLocal()));
          setSource("local");
          toast.error("SAT vocab: server load failed — using local");
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

  const setProgress = useCallback(
    (
      updater:
        | SatVocabProgress
        | ((prev: SatVocabProgress) => SatVocabProgress),
    ) => {
      setProgressState((prev) =>
        withCompleted(typeof updater === "function" ? updater(prev) : updater),
      );
      setDirty(true);
    },
    [],
  );

  const save = useCallback(async () => {
    setSaving(true);
    const payload = withCompleted(progressRef.current);
    try {
      if (source === "supabase") {
        const res = await fetch("/api/sat-vocab", {
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
        source === "supabase" ? "SAT progress saved" : "Saved locally",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [source]);

  // Autosave shortly after dirty changes
  useEffect(() => {
    if (!dirty || loading) return;
    const t = setTimeout(() => {
      void save();
    }, 800);
    return () => clearTimeout(t);
  }, [dirty, loading, progress, save]);

  const patchSession = useCallback(
    (planId: string, patch: Partial<SatSessionProgress>) => {
      setProgress((prev) => {
        const current = prev.sessions[planId];
        const next: SatSessionProgress = {
          learned: current?.learned ?? false,
          tested: current?.tested ?? false,
          learned_at: current?.learned_at,
          tested_at: current?.tested_at,
          scores: current?.scores,
          known_words: current?.known_words,
          ...patch,
        };
        return {
          ...prev,
          sessions: {
            ...prev.sessions,
            [planId]: next,
          },
          activity_dates: stampActivityDate(prev.activity_dates, todayISO()),
        };
      });
    },
    [setProgress],
  );

  const markLearned = useCallback(
    (planId: string, knownWords?: string[]) => {
      patchSession(planId, {
        learned: true,
        learned_at: new Date().toISOString(),
        known_words: knownWords,
      });
    },
    [patchSession],
  );

  const markRestDone = useCallback(
    (planId: string) => {
      patchSession(planId, {
        learned: true,
        learned_at: new Date().toISOString(),
      });
    },
    [patchSession],
  );

  const markTested = useCallback(
    (planId: string, drill: SatDrillType, score: number) => {
      setProgress((prev) => {
        const cur = prev.sessions[planId] ?? { learned: false, tested: false };
        const scores = { ...(cur.scores ?? {}), [drill]: score };
        return withCompleted({
          ...prev,
          sessions: {
            ...prev.sessions,
            [planId]: {
              ...cur,
              tested: true,
              tested_at: new Date().toISOString(),
              scores,
            },
          },
          activity_dates: stampActivityDate(prev.activity_dates, todayISO()),
        });
      });
      setDirty(true);
    },
    [setProgress],
  );

  const recordWordResult = useCallback(
    (word: string, correct: boolean) => {
      const key = word.toLowerCase();
      setProgress((prev) => {
        const cur = prev.word_stats[key] ?? {
          seen: 0,
          correct: 0,
          wrong: 0,
        };
        return {
          ...prev,
          word_stats: {
            ...prev.word_stats,
            [key]: {
              seen: cur.seen + 1,
              correct: cur.correct + (correct ? 1 : 0),
              wrong: cur.wrong + (correct ? 0 : 1),
              last_seen: new Date().toISOString(),
            },
          },
        };
      });
    },
    [setProgress],
  );

  const summary = progressSummary(progress);

  return (
    <SatVocabContext.Provider
      value={{
        progress,
        loading,
        saving,
        dirty,
        source,
        summary,
        setProgress,
        save,
        markLearned,
        markTested,
        recordWordResult,
        markRestDone,
      }}
    >
      {children}
    </SatVocabContext.Provider>
  );
}

export function useSatVocab() {
  const ctx = useContext(SatVocabContext);
  if (!ctx) throw new Error("useSatVocab must be used within SatVocabProvider");
  return ctx;
}

export { satVocabData };
