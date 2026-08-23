import { addDaysISO } from "./streak";
import { todayISO } from "@/lib/utils";
import type {
  SatAnswerDetail,
  SatQuizLogItem,
  SatWordStat,
} from "./types";

const INTERVALS = [1, 3, 7, 14, 30, 60];
const QUIZ_LOG_MAX = 40;

export function emptyWordStat(): SatWordStat {
  return {
    seen: 0,
    correct: 0,
    wrong: 0,
    last_seen: null,
    accuracy: 0,
    next_review: null,
    lapse_count: 0,
    confidence: 0,
    interval_days: 0,
    last_chosen: null,
    last_expected: null,
  };
}

export function normalizeWordStat(
  partial: Partial<SatWordStat> | null | undefined,
): SatWordStat {
  const base = emptyWordStat();
  const seen = partial?.seen ?? 0;
  const correct = partial?.correct ?? 0;
  const accuracy =
    partial?.accuracy ?? (seen ? Math.round((correct / seen) * 100) : 0);
  return {
    ...base,
    ...partial,
    seen,
    correct,
    wrong: partial?.wrong ?? 0,
    last_seen: partial?.last_seen ?? null,
    accuracy,
    next_review: partial?.next_review ?? null,
    lapse_count: partial?.lapse_count ?? 0,
    confidence: clampInt(partial?.confidence ?? 0, 0, 5),
    interval_days: partial?.interval_days ?? 0,
    last_chosen: partial?.last_chosen ?? null,
    last_expected: partial?.last_expected ?? null,
  };
}

export function applySrsResult(
  current: Partial<SatWordStat> | null | undefined,
  correct: boolean,
  detail?: SatAnswerDetail | null,
  today: string = todayISO(),
): SatWordStat {
  const cur = normalizeWordStat(current);
  const seen = cur.seen + 1;
  const correctN = cur.correct + (correct ? 1 : 0);
  const wrong = cur.wrong + (correct ? 0 : 1);
  const accuracy = Math.round((correctN / seen) * 100);

  let interval = cur.interval_days ?? 0;
  let confidence = cur.confidence;
  let lapse_count = cur.lapse_count;

  if (correct) {
    confidence = clampInt(confidence + 1, 0, 5);
    const step = Math.min(
      Math.max(confidence - 1, 0),
      INTERVALS.length - 1,
    );
    interval = INTERVALS[step] ?? 1;
  } else {
    lapse_count += 1;
    confidence = clampInt(confidence - 2, 0, 5);
    interval = 1;
  }

  return {
    seen,
    correct: correctN,
    wrong,
    last_seen: new Date().toISOString(),
    accuracy,
    next_review: addDaysISO(today, interval),
    lapse_count,
    confidence,
    interval_days: interval,
    last_chosen:
      detail?.chosen !== undefined ? detail.chosen : (cur.last_chosen ?? null),
    last_expected:
      detail?.expected !== undefined
        ? detail.expected
        : (cur.last_expected ?? null),
  };
}

export function appendQuizLog(
  log: SatQuizLogItem[] | undefined,
  item: SatQuizLogItem,
): SatQuizLogItem[] {
  return [...(log ?? []), item].slice(-QUIZ_LOG_MAX);
}

function clampInt(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)));
}
