import type { HubData } from "./types";
import { pct, toISODate, todayISO } from "./utils";

export function habitLogFor(data: HubData, habitId: string, date: string) {
  return data.habitLogs.find(
    (l) => l.habit_id === habitId && l.log_date === date,
  );
}

export function isHabitDone(data: HubData, habitId: string, date: string) {
  return Boolean(habitLogFor(data, habitId, date)?.completed);
}

export function activeHabits(data: HubData) {
  return data.habits
    .filter((h) => h.status === "active")
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Completion for a given date across all active habits. */
export function completionForDate(data: HubData, date: string) {
  const habits = activeHabits(data);
  const done = habits.filter((h) => isHabitDone(data, h.id, date)).length;
  return { done, total: habits.length, pct: pct(done, habits.length) };
}

export function todayCompletion(data: HubData) {
  return completionForDate(data, todayISO());
}

/** Current consecutive-day streak for a habit (today has a grace day). */
export function habitStreak(data: HubData, habitId: string): number {
  const done = new Set(
    data.habitLogs
      .filter((l) => l.habit_id === habitId && l.completed)
      .map((l) => l.log_date),
  );
  const cursor = new Date();
  if (!done.has(todayISO())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (done.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface Deadline {
  id: string;
  title: string;
  date: string;
  kind: "task" | "goal";
  meta?: string;
}

/** Upcoming task + goal deadlines within `days` (defaults to 14). */
export function upcomingDeadlines(data: HubData, days = 14): Deadline[] {
  const today = todayISO();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + days);
  const horizonISO = toISODate(horizon);

  const taskDeadlines: Deadline[] = data.tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        t.due_date &&
        t.due_date >= today &&
        t.due_date <= horizonISO,
    )
    .map((t) => ({
      id: t.id,
      title: t.title,
      date: t.due_date!,
      kind: "task",
      meta: t.project ?? undefined,
    }));

  const goalDeadlines: Deadline[] = data.goals
    .filter(
      (g) =>
        g.status === "active" &&
        g.target_date &&
        g.target_date >= today &&
        g.target_date <= horizonISO,
    )
    .map((g) => ({
      id: g.id,
      title: g.title,
      date: g.target_date!,
      kind: "goal",
      meta: `${g.progress}%`,
    }));

  return [...taskDeadlines, ...goalDeadlines].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** ISO date of the Monday that starts the week containing `d`. */
export function weekStart(d: Date): string {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  return toISODate(date);
}

/** Aggregate a numeric field per ISO week for the last `weeks` weeks. */
export function byWeek<T>(
  rows: T[],
  getDate: (row: T) => string | null | undefined,
  getValue: (row: T) => number,
  weeks = 6,
): { week: string; label: string; value: number }[] {
  const buckets = new Map<string, number>();
  const order: string[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const ws = weekStart(d);
    if (!buckets.has(ws)) {
      buckets.set(ws, 0);
      order.push(ws);
    }
  }
  for (const row of rows) {
    const date = getDate(row);
    if (!date) continue;
    const ws = weekStart(new Date(date));
    if (buckets.has(ws)) buckets.set(ws, (buckets.get(ws) ?? 0) + getValue(row));
  }
  return order.map((ws) => {
    const d = new Date(ws);
    return {
      week: ws,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: buckets.get(ws) ?? 0,
    };
  });
}

/** Habit completion percentage per week over the last `weeks` weeks. */
export function habitCompletionByWeek(data: HubData, weeks = 6) {
  const habits = activeHabits(data);
  const now = new Date();
  const result: { label: string; value: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - i * 7);
    const ws = weekStart(start);
    let done = 0;
    let total = 0;
    for (let day = 0; day < 7; day++) {
      const d = new Date(ws);
      d.setDate(d.getDate() + day);
      const iso = toISODate(d);
      if (iso > todayISO()) continue;
      for (const h of habits) {
        total++;
        if (isHabitDone(data, h.id, iso)) done++;
      }
    }
    const label = new Date(ws).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    result.push({ label, value: pct(done, total) });
  }
  return result;
}

/** Analytics summary for the last 30 days. */
export function last30Days(data: HubData) {
  const start = new Date();
  start.setDate(start.getDate() - 29);
  const startISO = toISODate(start);

  const studyMinutes = data.studySessions
    .filter((s) => s.session_date >= startISO)
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  const gymSessions = data.gymSessions.filter(
    (g) => g.session_date >= startISO,
  ).length;

  const journalEntries = data.journal.filter(
    (j) => j.entry_date >= startISO,
  );
  const avgMood =
    journalEntries.length > 0
      ? Number(
          (
            journalEntries.reduce((s, j) => s + j.mood, 0) /
            journalEntries.length
          ).toFixed(1),
        )
      : null;

  const habitLogs = data.habitLogs.filter((l) => l.log_date >= startISO);
  const habitCompleted = habitLogs.filter((l) => l.completed).length;
  const habitCompletionPct = pct(habitCompleted, habitLogs.length);

  const moviesWatched = data.movies.filter(
    (m) => m.status === "watched" && (m.watched_date ?? "") >= startISO,
  ).length;
  const booksRead = data.books.filter(
    (b) => b.status === "read" && (b.finished_date ?? "") >= startISO,
  ).length;

  return {
    range: { start: startISO, end: todayISO() },
    studyMinutes,
    studyHours: Number((studyMinutes / 60).toFixed(1)),
    gymSessions,
    journalEntries: journalEntries.length,
    avgMood,
    habitCompletionPct,
    moviesWatched,
    booksRead,
  };
}
