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
  | "multiple_choice"
  | "mixed";

export type SatAnswerDetail = {
  /** What Emre picked or typed. */
  chosen?: string | null;
  /** The accepted / correct answer. */
  expected?: string | null;
};

export type SatWordResultHandler = (
  word: string,
  correct: boolean,
  detail?: SatAnswerDetail,
) => void;

export type SatQuizLogItem = {
  word: string;
  correct: boolean;
  chosen?: string | null;
  expected?: string | null;
  at: string;
};

export type SatGptMcItem = {
  kind?: "multiple_choice";
  word: string;
  prompt: string;
  choices: string[];
  /** Correct choice text (normalized on ingest). */
  answer: string;
};

export type SatGptTypeItem = {
  kind?: "type_word" | "type_definition";
  word: string;
  prompt: string;
  accepted: string[];
};

export type SatGptMatchPair = {
  kind?: "matching";
  word: string;
  definition: string;
};

export type SatGptItem =
  | (SatGptMcItem & { kind: "multiple_choice" })
  | (SatGptTypeItem & { kind: "type_word" | "type_definition" })
  | (SatGptMatchPair & { kind: "matching" });

export type SatGptQueuedTest = {
  id: string;
  plan_id: string;
  format: SatDrillType;
  title?: string;
  created_at: string;
  items: SatGptItem[];
};

export type SatWordStat = {
  seen: number;
  correct: number;
  wrong: number;
  last_seen?: string | null;
  /** 0–100, derived from correct/seen. */
  accuracy: number;
  /** YYYY-MM-DD when this word is due again. */
  next_review?: string | null;
  lapse_count: number;
  /** 0–5 recall strength. */
  confidence: number;
  interval_days?: number;
  last_chosen?: string | null;
  last_expected?: string | null;
};

export type SatVocabProgress = {
  plan_start: string;
  sessions: Record<string, SatSessionProgress>;
  word_stats: Record<string, SatWordStat>;
  /** Calendar days you actually studied (YYYY-MM-DD). */
  activity_dates: string[];
  /** Alias of activity_dates (calendar dots). */
  completed_dates: string[];
  /** One queued Custom GPT test per plan session. */
  pending_gpt_tests?: Record<string, SatGptQueuedTest>;
  /** Latest in-app quiz answers (chosen vs expected), newest last. */
  recent_quiz_log?: SatQuizLogItem[];
  /** One-time last-7-day streak backfill. */
  streak_backfill_rev?: number;
};

export function emptySatProgress(planStart = "2026-07-31"): SatVocabProgress {
  return {
    plan_start: planStart,
    sessions: {},
    word_stats: {},
    activity_dates: [],
    completed_dates: [],
    pending_gpt_tests: {},
    recent_quiz_log: [],
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
