import type { Habit, HabitFrequency } from "./types";

/** Monday = 0 … Sunday = 6 (local timezone). */
export type WeekdayMon0 = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const HABIT_WEEKDAY_OPTIONS: { value: WeekdayMon0; label: string }[] = [
  { value: 0, label: "Pzt" },
  { value: 1, label: "Sal" },
  { value: 2, label: "Çar" },
  { value: 3, label: "Per" },
  { value: 4, label: "Cum" },
  { value: 5, label: "Cmt" },
  { value: 6, label: "Paz" },
];

export function weekdayMon0FromDate(d: Date): WeekdayMon0 {
  return ((d.getDay() + 6) % 7) as WeekdayMon0;
}

export function weekdayMon0FromIso(iso: string): WeekdayMon0 {
  return weekdayMon0FromDate(new Date(`${iso}T12:00:00`));
}

export function normalizeScheduleDays(
  raw: unknown,
): WeekdayMon0[] | null {
  if (!Array.isArray(raw)) return null;
  const set = new Set<WeekdayMon0>();
  for (const n of raw) {
    const v = Number(n);
    if (Number.isInteger(v) && v >= 0 && v <= 6) {
      set.add(v as WeekdayMon0);
    }
  }
  const days = [...set].sort((a, b) => a - b);
  return days.length > 0 ? days : null;
}

export function isHabitDueOn(habit: Habit, iso: string): boolean {
  if (habit.frequency === "daily" || habit.frequency === "weekly") {
    return true;
  }
  if (habit.frequency !== "custom") return true;
  const days = normalizeScheduleDays(habit.schedule_days);
  if (!days?.length) return false;
  return days.includes(weekdayMon0FromIso(iso));
}

export function formatHabitFrequency(habit: Habit): string {
  if (habit.frequency === "custom") {
    const days = normalizeScheduleDays(habit.schedule_days);
    if (!days?.length) return "Özel";
    const labels = HABIT_WEEKDAY_OPTIONS.filter((o) =>
      days.includes(o.value),
    ).map((o) => o.label);
    return `Özel (${labels.join(", ")})`;
  }
  if (habit.frequency === "weekly") return "Haftalık";
  return "Günlük";
}

export function habitFrequencyForSave(
  frequency: HabitFrequency,
  scheduleDays: WeekdayMon0[],
): Pick<Habit, "frequency" | "schedule_days"> {
  if (frequency === "custom") {
    return {
      frequency: "custom",
      schedule_days: [...scheduleDays].sort((a, b) => a - b),
    };
  }
  return { frequency, schedule_days: null };
}
