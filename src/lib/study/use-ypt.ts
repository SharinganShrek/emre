"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHub } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toISODate, uid } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  SETTINGS_KEY,
  TIMER_KEY,
  TODOS_KEY,
  addDaysISO,
  durationMinutesFromMs,
  encodeYptNotes,
  endOfLocalDay,
  isCustomSettings,
  loadJson,
  mergeContiguousSlots,
  mergeSettings,
  mergeTimer,
  parseYptNotes,
  saveJson,
  sessionBounds,
  sessionMs,
  subjectById,
  subtractTimeHoles,
  untimedBlocksForDate,
  type TodosByDate,
  type YptSettings,
  type YptTimerState,
} from "./ypt";

const MIN_SAVE_MS = 10_000;

export function useYptStudy() {
  const { data, add, remove } = useHub();
  const [settings, setSettingsState] = useState<YptSettings>(() =>
    mergeSettings(loadJson(SETTINGS_KEY, null)),
  );
  const [timer, setTimerState] = useState<YptTimerState>(() =>
    mergeTimer(loadJson(TIMER_KEY, null)),
  );
  const [todosByDate, setTodosByDate] = useState<TodosByDate>(() =>
    loadJson(TODOS_KEY, {}),
  );
  const [now, setNow] = useState(() => Date.now());
  const [syncReady, setSyncReady] = useState(!isSupabaseConfigured());
  const [syncSource, setSyncSource] = useState<"local" | "supabase">("local");
  const skipInitialSyncPut = useRef(true);

  const timerRef = useRef(timer);
  const settingsRef = useRef(settings);
  timerRef.current = timer;
  settingsRef.current = settings;

  const ticking = timer.running;

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setSyncReady(true);
        return;
      }

      try {
        const res = await fetch("/api/study-settings", {
          credentials: "same-origin",
        });
        if (res.status === 401 || res.status === 503) {
          if (!cancelled) setSyncSource("local");
          return;
        }
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { data: YptSettings | null };
        if (cancelled) return;
        setSyncSource("supabase");
        if (json.data) {
          setSettingsState(mergeSettings(json.data));
        } else if (isCustomSettings(settingsRef.current)) {
          await fetch("/api/study-settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ data: settingsRef.current }),
          });
        }
      } catch {
        if (!cancelled) setSyncSource("local");
      } finally {
        if (!cancelled) setSyncReady(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    saveJson(SETTINGS_KEY, settings);
  }, [settings]);

  useEffect(() => {
    if (!syncReady || syncSource !== "supabase") return;
    if (skipInitialSyncPut.current) {
      skipInitialSyncPut.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/study-settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ data: settingsRef.current }),
          });
          if (!res.ok) throw new Error("Save failed");
        } catch {
          toast.error("Could not sync study subjects");
        }
      })();
    }, 700);
    return () => window.clearTimeout(t);
  }, [settings, syncReady, syncSource]);

  useEffect(() => {
    saveJson(TIMER_KEY, timer);
  }, [timer]);

  useEffect(() => {
    saveJson(TODOS_KEY, todosByDate);
  }, [todosByDate]);

  useEffect(() => {
    if (settings.subjects.some((s) => s.id === timer.subjectId)) return;
    const first = settings.subjects[0];
    if (!first) return;
    setTimerState((prev) => ({ ...prev, subjectId: first.id }));
  }, [settings.subjects, timer.subjectId]);

  const commitRange = useCallback(
    async (startedAt: number, endedAt: number, subjectName: string) => {
      const ms = endedAt - startedAt;
      if (ms < MIN_SAVE_MS) return;
      const start = new Date(startedAt);
      const end = new Date(endedAt);
      await add("studySessions", {
        user_id: data.profile.user_id,
        subject: subjectName,
        duration_minutes: durationMinutesFromMs(ms),
        session_date: toISODate(new Date(startedAt)),
        notes: encodeYptNotes(start, end),
      });
    },
    [add, data.profile.user_id],
  );

  const commitSlices = useCallback(
    async (startedAt: number, until: number, subjectName: string) => {
      try {
        let cursor = startedAt;
        while (cursor < until) {
          const dayEnd = endOfLocalDay(cursor);
          const sliceEnd = Math.min(until, dayEnd);
          await commitRange(cursor, sliceEnd, subjectName);
          cursor = sliceEnd;
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save study block",
        );
      }
    },
    [commitRange],
  );

  const nameOf = useCallback((subjectId: string) => {
    return subjectById(settingsRef.current.subjects, subjectId)?.name ?? "Study";
  }, []);

  useEffect(() => {
    const current = timerRef.current;
    if (!current.running || current.startedAt == null) return;
    if (toISODate(new Date(current.startedAt)) === toISODate(new Date(now))) {
      return;
    }
    const from = current.startedAt;
    setTimerState((prev) => ({ ...prev, startedAt: now }));
    void commitSlices(from, now, nameOf(current.subjectId));
  }, [now, commitSlices, nameOf]);

  const liveMs =
    timer.running && timer.startedAt != null
      ? Math.max(0, now - timer.startedAt)
      : 0;

  const today = toISODate(new Date(now));
  const todaySavedMs = useMemo(
    () =>
      data.studySessions
        .filter((s) => s.session_date === today)
        .reduce((sum, s) => sum + sessionMs(s), 0),
    [data.studySessions, today],
  );
  const todayMs = todaySavedMs + liveMs;

  const activeSubject =
    subjectById(settings.subjects, timer.subjectId) ?? settings.subjects[0];

  const pause = useCallback(() => {
    const current = timerRef.current;
    if (!current.running || current.startedAt == null) return;
    const t = Date.now();
    const from = current.startedAt;
    const id = current.subjectId;
    setTimerState({
      running: false,
      subjectId: id,
      startedAt: null,
      restStartedAt: null,
      restMs: 0,
    });
    setNow(t);
    void commitSlices(from, t, nameOf(id));
  }, [commitSlices, nameOf]);

  const play = useCallback(
    (subjectId?: string) => {
      const nextId = subjectId ?? timerRef.current.subjectId;
      const current = timerRef.current;
      if (current.running && current.subjectId === nextId) {
        pause();
        return;
      }

      const t = Date.now();
      const toCommit =
        current.running && current.startedAt != null
          ? { startedAt: current.startedAt, subjectId: current.subjectId }
          : null;

      setTimerState({
        running: true,
        subjectId: nextId,
        startedAt: t,
        restStartedAt: null,
        restMs: 0,
      });
      setNow(t);

      if (toCommit) {
        void commitSlices(toCommit.startedAt, t, nameOf(toCommit.subjectId));
      }
    },
    [commitSlices, nameOf, pause],
  );

  const toggle = useCallback(() => {
    if (timerRef.current.running) pause();
    else play();
  }, [pause, play]);

  const selectSubject = useCallback(
    (subjectId: string) => {
      if (timerRef.current.running) {
        play(subjectId);
        return;
      }
      setTimerState((prev) => ({ ...prev, subjectId }));
    },
    [play],
  );

  const setSettings = useCallback(
    (patch: Partial<YptSettings> | ((prev: YptSettings) => YptSettings)) => {
      setSettingsState((prev) =>
        typeof patch === "function" ? patch(prev) : { ...prev, ...patch },
      );
    },
    [],
  );

  const todos = todosByDate[today] ?? [];

  const addTodo = useCallback((date: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTodosByDate((prev) => ({
      ...prev,
      [date]: [
        ...(prev[date] ?? []),
        { id: uid("todo"), text: trimmed, done: false },
      ],
    }));
  }, []);

  const toggleTodo = useCallback((date: string, id: string) => {
    setTodosByDate((prev) => ({
      ...prev,
      [date]: (prev[date] ?? []).map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    }));
  }, []);

  const removeTodo = useCallback((date: string, id: string) => {
    setTodosByDate((prev) => ({
      ...prev,
      [date]: (prev[date] ?? []).filter((item) => item.id !== id),
    }));
  }, []);

  const carveSlots = useCallback(
    async (date: string, holes: { start: Date; end: Date }[]) => {
      if (holes.length === 0) return;
      const nextDay = addDaysISO(date, 1);
      const relevant = data.studySessions.filter(
        (s) => s.session_date === date || s.session_date === nextDay,
      );
      const untimed = relevant.filter(
        (s) => s.session_date === date && !parseYptNotes(s.notes),
      );
      const untimedPlaced = untimedBlocksForDate(untimed, date);
      const toRewrite: { id: string; remain: { start: Date; end: Date }[]; subject: string }[] = [];

      for (const session of relevant) {
        const bounds = sessionBounds(session);
        if (bounds) {
          if (!holes.some((h) => h.end > bounds.start && h.start < bounds.end)) {
            continue;
          }
          toRewrite.push({
            id: session.id,
            subject: session.subject,
            remain: subtractTimeHoles(bounds.start, bounds.end, holes),
          });
        }
      }

      untimed.forEach((session, i) => {
        const block = untimedPlaced[i];
        if (!block) return;
        if (holes.some((h) => h.end > block.start && h.start < block.end)) {
          toRewrite.push({ id: session.id, subject: session.subject, remain: [] });
        }
      });

      const seen = new Set<string>();
      for (const row of toRewrite) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        await remove("studySessions", row.id);
        for (const piece of row.remain) {
          await commitRange(piece.start.getTime(), piece.end.getTime(), row.subject);
        }
      }
    },
    [commitRange, data.studySessions, remove],
  );

  const fillPlannerSlots = useCallback(
    async (
      date: string,
      slots: { start: Date; end: Date }[],
      subjectName: string,
    ) => {
      if (slots.length === 0) return;
      try {
        await carveSlots(date, slots);
        for (const range of mergeContiguousSlots(slots)) {
          await commitSlices(
            range.start.getTime(),
            range.end.getTime(),
            subjectName,
          );
        }
        toast.success(`Logged ${slots.length * 10} min of ${subjectName}`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not add study blocks",
        );
      }
    },
    [carveSlots, commitSlices],
  );

  const clearPlannerSlots = useCallback(
    async (date: string, slots: { start: Date; end: Date }[]) => {
      if (slots.length === 0) return;
      try {
        await carveSlots(date, slots);
        toast.success(`Cleared ${slots.length * 10} min`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not clear study blocks",
        );
      }
    },
    [carveSlots],
  );

  return {
    settings,
    setSettings,
    timer,
    running: timer.running,
    activeSubject,
    today,
    todayMs,
    liveMs,
    now,
    play,
    pause,
    toggle,
    selectSubject,
    todos,
    todosByDate,
    addTodo,
    toggleTodo,
    removeTodo,
    sessions: data.studySessions,
    removeSession: (id: string) => remove("studySessions", id),
    fillPlannerSlots,
    clearPlannerSlots,
  };
}

export type YptStudy = ReturnType<typeof useYptStudy>;
