import { flattenQuestions } from "./report";
import type { SatPracticeAttempt, SatSection } from "./types";
import { SECTION_META } from "./types";

export function weakSkills(attempts: SatPracticeAttempt[], limit = 12) {
  const buckets = new Map<
    string,
    { section: SatSection; skill: string; domain: string; wrong: number; total: number }
  >();
  for (const attempt of attempts) {
    for (const row of flattenQuestions(
      attempt.section,
      attempt.modules,
      attempt.answers,
    )) {
      const skill = row.question.skill || "Unknown";
      const part = row.sectionKey;
      const key = `${part}:${skill}`;
      const cur = buckets.get(key) || {
        section: part,
        skill,
        domain: row.question.domain,
        wrong: 0,
        total: 0,
      };
      cur.total += 1;
      if (!row.isCorrect) cur.wrong += 1;
      buckets.set(key, cur);
    }
  }
  return [...buckets.values()]
    .map((row) => ({
      ...row,
      accuracy: row.total ? Math.round((100 * (row.total - row.wrong)) / row.total) : 0,
    }))
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy)
    .slice(0, limit);
}

export function attemptCards(attempts: SatPracticeAttempt[]) {
  return attempts.map((a) => ({
    id: a.id,
    title: a.title,
    section: a.section,
    source: a.source,
    section_label: SECTION_META[a.section].label,
    status: a.status,
    raw_correct: a.raw_correct,
    raw_total: a.raw_total,
    scaled_estimated: a.scaled_estimated,
    official_total: a.official_total,
    official_rw: a.official_rw,
    official_math: a.official_math,
    completed_at: a.completed_at,
    include_timing_in_report: a.include_timing_in_report,
    domain_stats: a.domain_stats,
  }));
}

export function focusNext(attempts: SatPracticeAttempt[]) {
  const weak = weakSkills(attempts, 5);
  if (!weak.length) return "No completed mocks yet.";
  const top = weak.filter((w) => w.wrong > 0).slice(0, 3);
  if (!top.length) return "Recent mocks look solid. Keep mixing Easy/Medium/Hard in both sections.";
  return top
    .map(
      (w) =>
        `${SECTION_META[w.section].short} · ${w.skill}: ${w.total - w.wrong}/${w.total} (${w.accuracy}%)`,
    )
    .join("; ");
}
