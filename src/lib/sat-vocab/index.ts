import { satVocabCatalog } from "./catalog";
import { getSatWords, getWordMap } from "./words-data";
import { normalizeWordStat } from "./srs";
import type {
  SatPlanDay,
  SatVocabData,
  SatVocabProgress,
  SatWord,
} from "./types";
import { emptySatProgress, isSessionComplete } from "./types";
import { applyStreakBackfill } from "./streak";
import { todayISO } from "@/lib/utils";

export { satVocabCatalog } from "./catalog";

/** Back-compat view: plan/meta load eagerly; words load on first access. */
export const satVocabData: SatVocabData = {
  meta: satVocabCatalog.meta,
  themes: satVocabCatalog.themes,
  plan: satVocabCatalog.plan,
  get words() {
    return getSatWords();
  },
};

export function getWord(word: string): SatWord | undefined {
  return getWordMap().get(word.toLowerCase());
}

export function getWordsForPlanDay(day: SatPlanDay): SatWord[] {
  if (day.kind === "learn") {
    return day.words
      .map((w) => getWord(w))
      .filter((w): w is SatWord => Boolean(w));
  }
  if (day.kind === "review") {
    const weekLearn = satVocabCatalog.plan.filter(
      (p) => p.week === day.week && p.kind === "learn",
    );
    const words: SatWord[] = [];
    const seen = new Set<string>();
    for (const p of weekLearn) {
      for (const name of p.words) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const w = getWord(name);
        if (w) words.push(w);
      }
    }
    return words;
  }
  return [];
}

export function wordsByTheme(theme: string): SatWord[] {
  return getSatWords().filter((w) => w.theme === theme);
}

export function mergeProgress(
  partial: Partial<SatVocabProgress> | null | undefined,
): SatVocabProgress {
  const base = emptySatProgress(satVocabCatalog.meta.plan_start);
  if (!partial) return base;
  const activity = Array.isArray(partial.activity_dates)
    ? [...partial.activity_dates]
    : [];
  const completed = [...new Set(activity)].sort();
  const word_stats: SatVocabProgress["word_stats"] = {};
  for (const [key, stat] of Object.entries(partial.word_stats ?? {})) {
    word_stats[key] = normalizeWordStat(stat);
  }
  const merged = {
    plan_start: partial.plan_start || base.plan_start,
    sessions: { ...partial.sessions },
    word_stats,
    activity_dates: completed,
    completed_dates: completed,
    pending_gpt_tests: { ...(partial.pending_gpt_tests ?? {}) },
    recent_quiz_log: [...(partial.recent_quiz_log ?? [])].slice(-40),
    streak_backfill_rev: partial.streak_backfill_rev ?? 0,
  };
  return applyStreakBackfill(merged);
}

/** Keep completed_dates in sync with days actually studied. */
export function recomputeCompletedDates(
  progress: SatVocabProgress,
): string[] {
  return [...new Set(progress.activity_dates ?? [])].sort();
}

export function nextOpenDay(progress: SatVocabProgress) {
  return (
    satVocabCatalog.plan.find(
      (d) => !isSessionComplete(d, progress.sessions[d.id]),
    ) ?? null
  );
}

export function progressSummary(progress: SatVocabProgress) {
  const learnDays = satVocabCatalog.plan.filter((p) => p.kind === "learn");
  const learned = learnDays.filter(
    (d) => progress.sessions[d.id]?.learned,
  ).length;
  const tested = learnDays.filter((d) => progress.sessions[d.id]?.tested).length;
  const wordsSeen = Object.keys(progress.word_stats).length;
  const today = todayISO();
  const dueToday = Object.values(progress.word_stats).filter((raw) => {
    const s = normalizeWordStat(raw);
    return Boolean(s.seen >= 1 && s.next_review && s.next_review <= today);
  }).length;
  return {
    learn_total: learnDays.length,
    learned,
    tested,
    study_days: (progress.activity_dates ?? []).length,
    completed_days: (progress.activity_dates ?? []).length,
    plan_total: satVocabCatalog.plan.length,
    words_touched: wordsSeen,
    words_total: satVocabCatalog.meta.word_count,
    due_today: dueToday,
  };
}
