import type { AiContext } from "@/lib/ai/permissions";
import { isHubSyncConfigured } from "@/lib/access";
import {
  fetchSatVocabProgress,
  saveSatVocabProgress,
} from "@/lib/supabase/sat-vocab-repository";
import {
  getWord,
  getWordsForPlanDay,
  progressSummary,
  recomputeCompletedDates,
  satVocabData,
  wordsByTheme,
} from "@/lib/sat-vocab";
import {
  emptySatProgress,
  isSessionComplete,
  type SatDrillType,
  type SatPlanDay,
  type SatSessionProgress,
  type SatVocabProgress,
  type SatWord,
} from "@/lib/sat-vocab/types";
import { AiPermissionError } from "@/lib/ai/permissions";

export type SatWordCard = {
  no: number;
  word: string;
  pos: string;
  definition: string;
  turkish: string;
  theme: string;
  study_split?: string;
  prefix?: string;
  core_stem?: string;
  root_family?: string;
  root_meaning?: string;
  suffix?: string;
  morphology_note?: string;
  detailed_definition_en?: string;
  detailed_definition_tr?: string;
  example_pattern?: string;
};

export async function loadSatProgress(
  ctx: AiContext,
): Promise<SatVocabProgress> {
  if (!isHubSyncConfigured()) {
    return emptySatProgress(satVocabData.meta.plan_start);
  }
  return fetchSatVocabProgress(ctx.admin, ctx.userId);
}

export async function persistSatProgress(
  ctx: AiContext,
  progress: SatVocabProgress,
): Promise<SatVocabProgress> {
  if (!isHubSyncConfigured()) {
    throw new AiPermissionError(
      "Hub sync is not configured. SAT vocab writes need SUPABASE_SERVICE_ROLE_KEY.",
      503,
    );
  }
  const next = {
    ...progress,
    completed_dates: recomputeCompletedDates(progress),
  };
  await saveSatVocabProgress(ctx.admin, ctx.userId, next);
  return next;
}

export function toCard(word: SatWord, detail: "compact" | "full"): SatWordCard {
  const base: SatWordCard = {
    no: word.no,
    word: word.word,
    pos: word.pos,
    definition: word.definition,
    turkish: word.turkish,
    theme: word.theme,
  };
  if (detail === "compact") return base;
  return {
    ...base,
    study_split: word.study_split || undefined,
    prefix: word.prefix || undefined,
    core_stem: word.core_stem || undefined,
    root_family: word.root_family || undefined,
    root_meaning: word.root_meaning || undefined,
    suffix: word.suffix || undefined,
    morphology_note: word.morphology_note || undefined,
    detailed_definition_en: word.detailed_definition_en || undefined,
    detailed_definition_tr: word.detailed_definition_tr || undefined,
    example_pattern: word.example_pattern || undefined,
  };
}

export function findPlanDay(opts: {
  plan_id?: string;
  date?: string;
  session_num?: number;
}): SatPlanDay | undefined {
  const { plan_id, date, session_num } = opts;
  if (plan_id) {
    return satVocabData.plan.find((p) => p.id === plan_id);
  }
  if (date) {
    return satVocabData.plan.find((p) => p.scheduled_date === date);
  }
  if (session_num != null) {
    return satVocabData.plan.find((p) => p.session_num === session_num);
  }
  return undefined;
}

export function planDayWithProgress(
  day: SatPlanDay,
  progress: SatVocabProgress,
) {
  const session = progress.sessions[day.id];
  return {
    ...day,
    complete: isSessionComplete(day, session),
    session_progress: session ?? {
      learned: false,
      tested: false,
    },
  };
}

export function nextOpenDay(progress: SatVocabProgress): SatPlanDay | null {
  return (
    satVocabData.plan.find(
      (d) => !isSessionComplete(d, progress.sessions[d.id]),
    ) ?? null
  );
}

export function weakWords(progress: SatVocabProgress, limit = 20) {
  return Object.entries(progress.word_stats)
    .map(([word, s]) => ({
      word,
      seen: s.seen,
      correct: s.correct,
      wrong: s.wrong,
      accuracy: s.seen ? Math.round((s.correct / s.seen) * 100) : 0,
      last_seen: s.last_seen ?? null,
      card: (() => {
        const full = getWord(word);
        return full ? toCard(full, "compact") : null;
      })(),
    }))
    .filter((w) => w.seen >= 1 && w.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong)
    .slice(0, limit);
}

export function lookupWords(opts: {
  word?: string;
  q?: string;
  theme?: string;
  offset: number;
  limit: number;
  detail: "compact" | "full";
}) {
  let list: SatWord[] = [];
  if (opts.word) {
    const found = getWord(opts.word);
    list = found ? [found] : [];
  } else if (opts.theme) {
    list = wordsByTheme(opts.theme);
  } else if (opts.q) {
    const needle = opts.q.toLowerCase();
    list = satVocabData.words.filter(
      (w) =>
        w.word.toLowerCase().includes(needle) ||
        w.definition.toLowerCase().includes(needle) ||
        w.turkish.toLowerCase().includes(needle),
    );
  } else {
    list = satVocabData.words;
  }

  const total = list.length;
  const slice = list.slice(opts.offset, opts.offset + opts.limit);
  return {
    total,
    offset: opts.offset,
    limit: opts.limit,
    words: slice.map((w) => toCard(w, opts.detail)),
  };
}

export function applyLearn(
  progress: SatVocabProgress,
  planId: string,
  knownWords?: string[],
): SatVocabProgress {
  const current = progress.sessions[planId] ?? { learned: false, tested: false };
  const next: SatSessionProgress = {
    ...current,
    learned: true,
    learned_at: new Date().toISOString(),
    known_words: knownWords ?? current.known_words,
  };
  return withSession(progress, planId, next);
}

export function applyTest(
  progress: SatVocabProgress,
  planId: string,
  drill: SatDrillType,
  score: number,
): SatVocabProgress {
  const current = progress.sessions[planId] ?? { learned: false, tested: false };
  const next: SatSessionProgress = {
    ...current,
    tested: true,
    tested_at: new Date().toISOString(),
    scores: { ...(current.scores ?? {}), [drill]: score },
  };
  return withSession(progress, planId, next);
}

export function applyRest(
  progress: SatVocabProgress,
  planId: string,
): SatVocabProgress {
  const current = progress.sessions[planId] ?? { learned: false, tested: false };
  return withSession(progress, planId, {
    ...current,
    learned: true,
    learned_at: new Date().toISOString(),
  });
}

export function applyWordResults(
  progress: SatVocabProgress,
  results: { word: string; correct: boolean }[],
): SatVocabProgress {
  const word_stats = { ...progress.word_stats };
  const now = new Date().toISOString();
  for (const r of results) {
    const key = r.word.toLowerCase();
    const cur = word_stats[key] ?? { seen: 0, correct: 0, wrong: 0 };
    word_stats[key] = {
      seen: cur.seen + 1,
      correct: cur.correct + (r.correct ? 1 : 0),
      wrong: cur.wrong + (r.correct ? 0 : 1),
      last_seen: now,
    };
  }
  return { ...progress, word_stats };
}

function withSession(
  progress: SatVocabProgress,
  planId: string,
  session: SatSessionProgress,
): SatVocabProgress {
  const next = {
    ...progress,
    sessions: { ...progress.sessions, [planId]: session },
  };
  return { ...next, completed_dates: recomputeCompletedDates(next) };
}

export function sessionPayload(
  day: SatPlanDay,
  progress: SatVocabProgress,
  detail: "compact" | "full",
) {
  const cards = getWordsForPlanDay(day).map((w) => toCard(w, detail));
  return {
    ...planDayWithProgress(day, progress),
    word_cards: cards,
    how_to_run:
      day.kind === "learn"
        ? "Teach each word with flashcards (EN definition + TR + morphology). Then quiz (matching / type-the-word / multiple choice)."
        : day.kind === "review"
          ? "Quiz this week's learned words. Mark the review tested when done."
          : "Rest / catch-up day. Mark rest done; no new words.",
  };
}

export { progressSummary, satVocabData };
