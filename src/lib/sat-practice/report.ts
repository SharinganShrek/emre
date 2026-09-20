import { answersMatch } from "./score";
import type {
  SatAnswerMap,
  SatFlagMap,
  SatModules,
  SatPracticeAttempt,
  SatQuestionRow,
  SatSection,
  SatTimingMap,
} from "./types";
import { answerKey, SECTION_META } from "./types";

export function formatSpent(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function flattenQuestions(
  section: SatSection,
  modules: SatModules,
  answers: SatAnswerMap = {},
  flagged: SatFlagMap = {},
  secondsSpent: SatTimingMap = {},
): SatQuestionRow[] {
  const sectionLabel = SECTION_META[section].label;
  const rows: SatQuestionRow[] = [];
  const push = (qs: typeof modules.m1, module: 1 | 2) => {
    (qs || []).forEach((question, index) => {
      const key = answerKey(module, index);
      const chosen = answers[key] || "";
      const isCorrect = answersMatch(chosen, question.correctAnswers);
      rows.push({
        key,
        module,
        index,
        number: rows.length + 1,
        sectionLabel,
        question,
        chosen: chosen || "—",
        correct: (question.correctAnswers || []).join(", ") || "—",
        isCorrect,
        flagged: !!flagged[key],
        secondsSpent:
          secondsSpent[key] == null ? null : Number(secondsSpent[key]),
      });
    });
  };
  push(modules.m1, 1);
  push(modules.m2, 2);
  return rows;
}

function domainLine(row: SatQuestionRow) {
  return [row.question.domain, row.question.skill, row.question.difficulty]
    .filter(Boolean)
    .join(" · ");
}

export function buildResultsReport(
  attempt: Pick<
    SatPracticeAttempt,
    | "section"
    | "modules"
    | "answers"
    | "flagged"
    | "seconds_spent"
    | "include_timing_in_report"
    | "raw_correct"
    | "raw_total"
    | "domain_stats"
  >,
  opts?: { includeTiming?: boolean },
) {
  const includeTiming =
    opts?.includeTiming ?? attempt.include_timing_in_report;
  const rows = flattenQuestions(
    attempt.section,
    attempt.modules,
    attempt.answers,
    attempt.flagged,
    attempt.seconds_spent,
  );
  const correct = attempt.raw_correct ?? rows.filter((r) => r.isCorrect).length;
  const total = attempt.raw_total ?? rows.length;
  const stats =
    attempt.domain_stats && attempt.domain_stats.length
      ? attempt.domain_stats
      : [];

  const lines = [
    "SAT®",
    "Results",
    `${correct} / ${total} correct`,
    "Domain\tCorrect",
  ];
  for (const s of stats) {
    lines.push(`${s.domain}\t${s.correct} / ${s.total}`);
  }
  lines.push("Review");

  for (const row of rows) {
    const mark = row.isCorrect ? "Correct" : "Incorrect";
    lines.push(`Module ${row.module}, Q${row.index + 1} ${mark}`);
    lines.push(domainLine(row));
    const stimulus = (row.question.stimulus || "").trim();
    const prompt = (row.question.prompt || "").trim();
    if (stimulus) lines.push(stimulus);
    if (prompt) {
      if (stimulus) lines.push("");
      lines.push(prompt);
    }
    if (row.question.answerOptions?.length) {
      lines.push("");
      for (const opt of row.question.answerOptions) {
        lines.push(`${opt.letter}. ${stripForReport(opt.content)}`);
      }
    }
    lines.push("");
    lines.push(`Your answer: ${row.chosen} · Correct: ${row.correct}`);
    if (includeTiming) {
      const spent = formatSpent(row.secondsSpent);
      lines.push(spent ? `Time spent: ${spent}` : "Time spent: —");
    }
    const rationale = (row.question.rationale || "").trim();
    if (rationale) {
      lines.push("");
      lines.push(rationale);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function stripForReport(html: string) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+\n/g, "\n")
    .trim();
}
