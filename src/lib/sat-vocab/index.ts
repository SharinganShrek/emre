import raw from "./data.json";
import type {
  SatPlanDay,
  SatVocabData,
  SatVocabProgress,
  SatWord,
} from "./types";
import { emptySatProgress, isSessionComplete } from "./types";

export const satVocabData = raw as SatVocabData;

const wordByLower = new Map(
  satVocabData.words.map((w) => [w.word.toLowerCase(), w] as const),
);

export function getWord(word: string): SatWord | undefined {
  return wordByLower.get(word.toLowerCase());
}

export function getWordsForPlanDay(day: SatPlanDay): SatWord[] {
  if (day.kind === "learn") {
    return day.words
      .map((w) => getWord(w))
      .filter((w): w is SatWord => Boolean(w));
  }
  if (day.kind === "review") {
    // Review = all learn sessions in the same week
    const weekLearn = satVocabData.plan.filter(
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
  return satVocabData.words.filter((w) => w.theme === theme);
}

export function mergeProgress(
  partial: Partial<SatVocabProgress> | null | undefined,
): SatVocabProgress {
  const base = emptySatProgress(satVocabData.meta.plan_start);
  if (!partial) return base;
  return {
    plan_start: partial.plan_start || base.plan_start,
    sessions: { ...partial.sessions },
    word_stats: { ...partial.word_stats },
    completed_dates: Array.isArray(partial.completed_dates)
      ? [...partial.completed_dates]
      : [],
  };
}

export function recomputeCompletedDates(
  progress: SatVocabProgress,
): string[] {
  const dates: string[] = [];
  for (const day of satVocabData.plan) {
    const sp = progress.sessions[day.id];
    if (isSessionComplete(day, sp)) {
      dates.push(day.scheduled_date);
    }
  }
  return dates;
}

export function progressSummary(progress: SatVocabProgress) {
  const learnDays = satVocabData.plan.filter((p) => p.kind === "learn");
  const learned = learnDays.filter(
    (d) => progress.sessions[d.id]?.learned,
  ).length;
  const tested = learnDays.filter((d) => progress.sessions[d.id]?.tested).length;
  const wordsSeen = Object.keys(progress.word_stats).length;
  return {
    learn_total: learnDays.length,
    learned,
    tested,
    completed_days: progress.completed_dates.length,
    plan_total: satVocabData.plan.length,
    words_touched: wordsSeen,
    words_total: satVocabData.meta.word_count,
  };
}
