import { todayISO } from "@/lib/utils";

/** Parse YYYY-MM-DD as a local calendar date (not UTC). */
export function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDaysISO(iso: string, days: number): string {
  const dt = parseISODateLocal(iso);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monday-start ISO week key, e.g. 2026-W34 */
export function isoWeekKey(iso: string): string {
  const date = parseISODateLocal(iso);
  const day = (date.getDay() + 6) % 7; // Mon=0
  const thursday = new Date(date);
  thursday.setDate(date.getDate() - day + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const week1 = new Date(jan4);
  week1.setDate(jan4.getDate() - jan4Day);
  const week = 1 + Math.round((thursday.getTime() - week1.getTime()) / 86_400_000 / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function startOfISOWeek(iso: string): string {
  const date = parseISODateLocal(iso);
  const day = (date.getDay() + 6) % 7;
  return addDaysISO(iso, -day);
}

export type SatStreak = {
  current: number;
  studied_today: boolean;
  shield_available: boolean;
  shield_used_this_week: boolean;
  week_days: {
    date: string;
    label: string;
    studied: boolean;
    shielded: boolean;
    is_today: boolean;
  }[];
};

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Day streak with one miss-shield per ISO week (Mon–Sun).
 * Today with no study yet does not break the streak (day still open).
 */
export function computeSatStreak(
  activityDates: string[],
  today: string = todayISO(),
): SatStreak {
  const studied = new Set(activityDates);
  const studiedToday = studied.has(today);

  const weekStart = startOfISOWeek(today);
  const weekDays = WEEKDAY_LABELS.map((label, i) => {
    const date = addDaysISO(weekStart, i);
    return {
      date,
      label,
      studied: studied.has(date),
      shielded: false,
      is_today: date === today,
    };
  });

  const { current, shieldedDates } = walkStreak(studied, today);

  for (const row of weekDays) {
    if (shieldedDates.has(row.date)) row.shielded = true;
  }

  const shieldUsedThisWeek = weekDays.some(
    (d) => d.shielded && d.date <= today,
  );

  return {
    current,
    studied_today: studiedToday,
    shield_available: !shieldUsedThisWeek,
    shield_used_this_week: shieldUsedThisWeek,
    week_days: weekDays,
  };
}

function walkStreak(
  studied: Set<string>,
  today: string,
): { current: number; shieldedDates: Set<string> } {
  const shieldedDates = new Set<string>();
  if (studied.size === 0) return { current: 0, shieldedDates };

  let cursor = studied.has(today) ? today : addDaysISO(today, -1);
  const shieldsUsedByWeek = new Set<string>();
  let current = 0;

  for (let i = 0; i < 800; i++) {
    if (studied.has(cursor)) {
      current += 1;
      cursor = addDaysISO(cursor, -1);
      continue;
    }

    const hasEarlier = [...studied].some((d) => d < cursor);
    if (!hasEarlier) break;

    const week = isoWeekKey(cursor);
    if (!shieldsUsedByWeek.has(week)) {
      shieldsUsedByWeek.add(week);
      shieldedDates.add(cursor);
      cursor = addDaysISO(cursor, -1);
      continue;
    }
    break;
  }

  return { current, shieldedDates };
}

export function stampActivityDate(
  dates: string[] | undefined,
  iso: string = todayISO(),
): string[] {
  const set = new Set(dates ?? []);
  set.add(iso);
  return [...set].sort();
}
