import type { StudySession } from "@/lib/types";
import { toISODate } from "@/lib/utils";

export const SETTINGS_KEY = "emre-hub:ypt:settings";
export const TIMER_KEY = "emre-hub:ypt:timer";
export const TODOS_KEY = "emre-hub:ypt:todos";

export const YPT_PALETTE = [
  "#5B8DEF",
  "#34D399",
  "#FBBF24",
  "#A78BFA",
  "#F472B6",
  "#FB7185",
  "#22D3EE",
  "#FB923C",
  "#4ADE80",
  "#94A3B8",
] as const;

export interface YptSubject {
  id: string;
  name: string;
  color: string;
}

export interface YptSettings {
  ddayLabel: string;
  ddayDate: string;
  subjects: YptSubject[];
}

export interface YptTimerState {
  running: boolean;
  subjectId: string;
  /** Epoch ms when the current block started. */
  startedAt: number | null;
  restStartedAt: number | null;
  restMs: number;
}

export interface YptTodo {
  id: string;
  text: string;
  done: boolean;
}

export type TodosByDate = Record<string, YptTodo[]>;

export interface YptNotes {
  ypt: true;
  start: string;
  end: string;
  ms: number;
}

export const DEFAULT_SUBJECTS: YptSubject[] = [
  { id: "sat-math", name: "SAT Math", color: "#5B8DEF" },
  { id: "sat-reading", name: "SAT Reading", color: "#34D399" },
  { id: "sat-writing", name: "SAT Writing", color: "#FBBF24" },
  { id: "vocab", name: "Vocab", color: "#A78BFA" },
  { id: "other", name: "Other", color: "#94A3B8" },
];

export const DEFAULT_SETTINGS: YptSettings = {
  ddayLabel: "SAT",
  ddayDate: "",
  subjects: DEFAULT_SUBJECTS,
};

export const DEFAULT_TIMER: YptTimerState = {
  running: false,
  subjectId: DEFAULT_SUBJECTS[0].id,
  startedAt: null,
  restStartedAt: null,
  restMs: 0,
};

/** Planner shows 05:00 → 01:50 next day (hours 5–25), YPT-style. */
export const PLANNER_HOURS = Array.from({ length: 21 }, (_, i) => 5 + i);

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function mergeSettings(raw: Partial<YptSettings> | null): YptSettings {
  const subjects =
    raw?.subjects && raw.subjects.length > 0
      ? raw.subjects
      : DEFAULT_SUBJECTS;
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    subjects,
  };
}

export function mergeTimer(raw: Partial<YptTimerState> | null): YptTimerState {
  return { ...DEFAULT_TIMER, ...raw };
}

export function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatClock(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function clockToMs(clock: string): number {
  const [h = 0, m = 0, s = 0] = clock.split(":").map(Number);
  return ((h * 60 + m) * 60 + s) * 1000;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

export function startOfWeekMonday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - offset);
  return toISODate(dt);
}

export function endOfLocalDay(epoch: number): number {
  const dt = new Date(epoch);
  return new Date(
    dt.getFullYear(),
    dt.getMonth(),
    dt.getDate() + 1,
  ).getTime();
}

export function ddayOffset(targetISO: string, today: string): number | null {
  if (!targetISO) return null;
  const a = new Date(`${today}T00:00:00`);
  const b = new Date(`${targetISO}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function formatDday(n: number): string {
  if (n === 0) return "D-Day";
  if (n > 0) return `D-${n}`;
  return `D+${Math.abs(n)}`;
}

export function encodeYptNotes(start: Date, end: Date): string {
  const payload: YptNotes = {
    ypt: true,
    start: formatClock(start),
    end: formatClock(end),
    ms: Math.max(0, end.getTime() - start.getTime()),
  };
  return JSON.stringify(payload);
}

export function parseYptNotes(notes: string | null | undefined): YptNotes | null {
  if (!notes) return null;
  const trimmed = notes.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<YptNotes>;
    if (!parsed.ypt || !parsed.start || typeof parsed.ms !== "number") {
      return null;
    }
    return {
      ypt: true,
      start: parsed.start,
      end: parsed.end ?? "",
      ms: parsed.ms,
    };
  } catch {
    return null;
  }
}

export function subjectById(
  subjects: YptSubject[],
  id: string,
): YptSubject | undefined {
  return subjects.find((s) => s.id === id);
}

export function colorForSubject(
  name: string,
  subjects: YptSubject[],
): string {
  const exact = subjects.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
  if (exact) return exact.color;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return YPT_PALETTE[Math.abs(hash) % YPT_PALETTE.length];
}

export function sessionBounds(session: StudySession): {
  start: Date;
  end: Date;
} | null {
  const meta = parseYptNotes(session.notes);
  if (!meta) return null;
  const [y, m, d] = session.session_date.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  start.setTime(start.getTime() + clockToMs(meta.start));
  return { start, end: new Date(start.getTime() + meta.ms) };
}

export function untimedBlocksForDate(
  sessions: StudySession[],
  dateISO: string,
): { start: Date; end: Date; subject: string }[] {
  const [y, m, d] = dateISO.split("-").map(Number);
  let cursor = new Date(y, m - 1, d, 9, 0, 0, 0).getTime();
  return sessions
    .filter((s) => s.session_date === dateISO && !parseYptNotes(s.notes))
    .map((s) => {
      const start = new Date(cursor);
      const end = new Date(cursor + s.duration_minutes * 60_000);
      cursor = end.getTime();
      return { start, end, subject: s.subject };
    });
}

export interface TimeBlock {
  start: Date;
  end: Date;
  subject: string;
  live?: boolean;
}

export function blocksForPlannerDate(
  sessions: StudySession[],
  dateISO: string,
  live?: { subject: string; startedAt: number; now: number } | null,
): TimeBlock[] {
  const next = addDaysISO(dateISO, 1);
  const [y, m, d] = dateISO.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d, 5, 0, 0, 0);
  const [ny, nm, nd] = next.split("-").map(Number);
  const dayEnd = new Date(ny, nm - 1, nd, 2, 0, 0, 0);

  const timed: TimeBlock[] = [];
  const untimedSessions: StudySession[] = [];

  for (const session of sessions) {
    if (session.session_date !== dateISO && session.session_date !== next) {
      continue;
    }
    const bounds = sessionBounds(session);
    if (bounds) {
      if (bounds.end > dayStart && bounds.start < dayEnd) {
        timed.push({ ...bounds, subject: session.subject });
      }
    } else if (session.session_date === dateISO) {
      untimedSessions.push(session);
    }
  }

  const result: TimeBlock[] = [
    ...timed,
    ...untimedBlocksForDate(untimedSessions, dateISO),
  ];

  if (live && live.now > live.startedAt) {
    result.push({
      start: new Date(live.startedAt),
      end: new Date(live.now),
      subject: live.subject,
      live: true,
    });
  }
  return result;
}

export function plannerSlotBounds(
  dayISO: string,
  hour: number,
  slot: number,
): { start: Date; end: Date } {
  const [y, m, d] = dayISO.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  start.setMinutes(hour * 60 + slot * 10);
  return { start, end: new Date(start.getTime() + 10 * 60_000) };
}

export function subjectInSlot(
  blocks: TimeBlock[],
  start: Date,
  end: Date,
): TimeBlock | null {
  let hit: TimeBlock | null = null;
  for (const block of blocks) {
    if (block.end > start && block.start < end) hit = block;
  }
  return hit;
}

export function minutesByDate(sessions: StudySession[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    map.set(
      s.session_date,
      (map.get(s.session_date) ?? 0) + sessionMs(s) / 60_000,
    );
  }
  return map;
}

export function minutesBySubject(
  sessions: StudySession[],
  extra?: { subject: string; minutes: number },
): { subject: string; minutes: number }[] {
  const map = new Map<string, number>();
  for (const s of sessions) {
    map.set(s.subject, (map.get(s.subject) ?? 0) + sessionMs(s) / 60_000);
  }
  if (extra && extra.minutes > 0) {
    map.set(extra.subject, (map.get(extra.subject) ?? 0) + extra.minutes);
  }
  return [...map.entries()]
    .map(([subject, minutes]) => ({ subject, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function heatmapLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  const hours = minutes / 60;
  if (hours < 1) return 1;
  if (hours < 3) return 2;
  if (hours < 5) return 3;
  return 4;
}

export function monthGrid(cursor: Date): { iso: string; inMonth: boolean }[][] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const weeks: { iso: string; inMonth: boolean }[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: { iso: string; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      row.push({
        iso: toISODate(dt),
        inMonth: dt.getMonth() === month,
      });
    }
    weeks.push(row);
  }
  return weeks;
}

export function durationMinutesFromMs(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000));
}

export function sessionMs(session: StudySession): number {
  const meta = parseYptNotes(session.notes);
  if (meta) return meta.ms;
  return session.duration_minutes * 60_000;
}
