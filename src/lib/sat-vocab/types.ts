export type SatWord = {
  no: number;
  word: string;
  pos: string;
  definition: string;
  theme: string;
  study_split: string;
  prefix: string;
  core_stem: string;
  root_family: string;
  root_meaning: string;
  suffix: string;
  morphology_note: string;
  turkish: string;
  detailed_definition_en: string;
  detailed_definition_tr: string;
  example_pattern: string;
};

export type SatPlanKind = "learn" | "review" | "rest";

export type SatPlanDay = {
  id: string;
  week: number;
  day_name: string;
  session_label: string;
  session_num: number | null;
  kind: SatPlanKind;
  theme_focus: string;
  word_count: number | null;
  words: string[];
  task_note: string;
  scheduled_date: string;
};

export type SatThemeSummary = {
  theme: string;
  order: number;
  word_count: number;
};

export type SatVocabData = {
  meta: {
    title: string;
    source: string;
    word_count: number;
    theme_count: number;
    plan_start: string;
    learn_sessions: number;
    review_days: number;
    rest_days: number;
  };
  themes: SatThemeSummary[];
  words: SatWord[];
  plan: SatPlanDay[];
};

export type SatSessionProgress = {
  learned: boolean;
  learned_at?: string | null;
  tested: boolean;
  tested_at?: string | null;
  /** Best scores 0–100 by drill type */
  scores?: Partial<Record<SatDrillType, number>>;
  /** Words marked "known" during flashcards */
  known_words?: string[];
};

export type SatDrillType =
  | "matching"
  | "type_word"
  | "type_definition"
  | "multiple_choice";

export type SatWordStat = {
  seen: number;
  correct: number;
  wrong: number;
  last_seen?: string | null;
};

export type SatVocabProgress = {
  plan_start: string;
  sessions: Record<string, SatSessionProgress>;
  word_stats: Record<string, SatWordStat>;
  /** Calendar days you actually studied (YYYY-MM-DD). */
  activity_dates: string[];
  /** Alias of activity_dates (calendar dots). */
  completed_dates: string[];
};

export function emptySatProgress(planStart = "2026-07-31"): SatVocabProgress {
  return {
    plan_start: planStart,
    sessions: {},
    word_stats: {},
    activity_dates: [],
    completed_dates: [],
  };
}

export function isSessionComplete(
  day: SatPlanDay,
  progress: SatSessionProgress | undefined,
): boolean {
  if (day.kind === "rest") return Boolean(progress?.learned);
  if (day.kind === "review") return Boolean(progress?.tested || progress?.learned);
  return Boolean(progress?.learned && progress?.tested);
}
