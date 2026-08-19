"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHub } from "@/lib/store";
import { toISODate, uid } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  SETTINGS_KEY,
  TIMER_KEY,
  TODOS_KEY,
  durationMinutesFromMs,
  encodeYptNotes,
  endOfLocalDay,
  loadJson,
  mergeSettings,
  mergeTimer,
  saveJson,
  sessionMs,
  subjectById,
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

  const timerRef = useRef(timer);
  const settingsRef = useRef(settings);
  timerRef.current = timer;
  settingsRef.current = settings;

  const ticking = timer.running || timer.restStartedAt != null;

  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    saveJson(SETTINGS_KEY, settings);
  }, [settings]);

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
  const restLiveMs =
    !timer.running && timer.restStartedAt != null
      ? Math.max(0, now - timer.restStartedAt)
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
  const restMs = timer.restMs + restLiveMs;

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
      restStartedAt: t,
      restMs: current.restMs,
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
        restMs:
          current.restStartedAt != null
            ? current.restMs + (t - current.restStartedAt)
            : current.restMs,
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

  return {
    settings,
    setSettings,
    timer,
    running: timer.running,
    activeSubject,
    today,
    todayMs,
    liveMs,
    restMs,
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
  };
}

export type YptStudy = ReturnType<typeof useYptStudy>;
